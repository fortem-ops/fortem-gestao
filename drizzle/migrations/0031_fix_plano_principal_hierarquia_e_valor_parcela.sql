-- 1) Hierarquia explícita de plano principal: tipos principais sempre antes de Corrida.
CREATE OR REPLACE FUNCTION public.fn_plano_principal_ativo(p_aluno_id uuid)
RETURNS public.planos
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.planos p
  WHERE p.aluno_id = p_aluno_id
    AND p.ativo = true
  ORDER BY
    CASE
      WHEN coalesce(p.atividade, '') = 'treinamento_funcional' THEN 0
      WHEN coalesce(p.atividade, '') = 'corrida' THEN 2
      WHEN lower(coalesce(p.tipo, '')) ~ '(^|[^a-z])(start\+?|power|pro|max|vip|gympass|wellhub|total\s*pass|totalpass)([^a-z]|$)' THEN 0
      ELSE 1
    END ASC,
    (
      p.data_fim IS NULL
      OR p.data_fim >= CURRENT_DATE
      OR COALESCE(p.renovacao_automatica, false)
    ) DESC,
    p.created_at DESC
  LIMIT 1;
$function$;

-- 2) Fiscal de Pagamentos: valor divergente usa o plano DO CONTRATO e o valor da parcela.
CREATE OR REPLACE FUNCTION public.fn_auditoria_fiscal_pagamentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sem_contrato int := 0;
  v_valor int := 0;
  v_pendente int := 0;
  v_cert int := 0;
  v_plano_exp int := 0;
BEGIN
  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'pagamento',
      'cobranca_sem_contrato_ativo',
      'critico',
      'Cobrança de ' || to_char(c.valor, 'FM999999990.00') || ' com vencimento em ' ||
        to_char(c.data_vencimento, 'DD/MM/YYYY') || ' está ligada a um contrato fora de vigência (status ' || ct.status || ').',
      c.aluno_id,
      jsonb_build_object('cobranca_id', c.id, 'contrato_id', ct.id, 'aluno_id', c.aluno_id)
    FROM public.cobrancas c
    JOIN public.contratos ct ON ct.id = c.contrato_id
    WHERE c.data_vencimento >= current_date - interval '12 months'
      AND c.status <> 'cancelado'
      AND (
        c.data_vencimento < ct.data_inicio
        OR (ct.data_fim IS NOT NULL AND c.data_vencimento > ct.data_fim)
        OR (ct.status IN ('cancelado', 'encerrado')
            AND ct.data_cancelamento IS NOT NULL
            AND c.data_vencimento > ct.data_cancelamento)
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_sem_contrato FROM novos;

  WITH ref AS (
    SELECT
      c.id   AS cobranca_id,
      c.aluno_id,
      c.valor,
      c.data_vencimento,
      ct.id  AS contrato_id,
      ct.valor_cobrado,
      CASE WHEN coalesce(ct.parcelas, 0) > 1
           THEN round(ct.valor_cobrado / ct.parcelas, 2)
           ELSE ct.valor_cobrado END AS valor_parcela,
      pl.id AS plano_id,
      CASE WHEN coalesce(pl.duracao_meses, 0) > 1
           THEN round(pl.valor / pl.duracao_meses, 2)
           ELSE pl.valor END AS plano_mensal
    FROM public.cobrancas c
    JOIN public.contratos ct ON ct.id = c.contrato_id
    LEFT JOIN public.planos pl ON pl.id = ct.plano_id
    WHERE c.data_vencimento >= current_date - interval '90 days'
      AND c.status <> 'cancelado'
      AND ct.valor_cobrado IS NOT NULL
      AND ct.valor_cobrado > 0
  ), novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'pagamento',
      'valor_divergente_plano',
      'atencao',
      'Cobrança de ' || to_char(r.valor, 'FM999999990.00') || ' (venc. ' ||
        to_char(r.data_vencimento, 'DD/MM/YYYY') || ') difere do valor contratado (' ||
        to_char(r.valor_cobrado, 'FM999999990.00') || ') e do valor da parcela do contrato (' ||
        to_char(r.valor_parcela, 'FM999999990.00') || ').',
      r.aluno_id,
      jsonb_build_object('cobranca_id', r.cobranca_id, 'contrato_id', r.contrato_id,
                         'plano_id', r.plano_id, 'aluno_id', r.aluno_id)
    FROM ref r
    WHERE abs(r.valor - r.valor_cobrado) > 0.01
      AND abs(r.valor - r.valor_parcela) > 0.01
      AND (r.plano_mensal IS NULL OR abs(r.valor - r.plano_mensal) > 0.01)
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_valor FROM novos;

  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'pagamento',
      'cobranca_pendente_sem_retry',
      'atencao',
      'Cobrança pendente desde ' || to_char(c.data_vencimento, 'DD/MM/YYYY') ||
        ' (mais de 5 dias) sem nenhuma tentativa de cobrança registrada.',
      c.aluno_id,
      jsonb_build_object('cobranca_id', c.id, 'contrato_id', c.contrato_id, 'aluno_id', c.aluno_id)
    FROM public.cobrancas c
    WHERE c.status = 'pendente'
      AND c.data_vencimento < current_date - 5
      AND c.data_vencimento >= current_date - interval '12 months'
      AND coalesce(c.tentativas, 0) = 0
      AND c.ultima_tentativa_em IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.cobranca_tentativas t WHERE t.parcela_id = c.id)
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_pendente FROM novos;

  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, registros_afetados)
    SELECT
      'integracao',
      'certificado_vencendo',
      CASE WHEN ic.data_validade <= current_date THEN 'critico' ELSE 'atencao' END,
      'Certificado "' || ic.nome || '" ' ||
        CASE WHEN ic.data_validade <= current_date
             THEN 'venceu em ' || to_char(ic.data_validade, 'DD/MM/YYYY') || '.'
             ELSE 'vence em ' || to_char(ic.data_validade, 'DD/MM/YYYY') || ' (' ||
                  (ic.data_validade - current_date)::text || ' dias).' END,
      jsonb_build_object('certificado_id', ic.id, 'chave', ic.chave, 'data_validade', ic.data_validade)
    FROM public.integracao_certificados ic
    WHERE ic.ativo = true
      AND ic.data_validade IS NOT NULL
      AND ic.data_validade <= current_date + (ic.dias_alerta || ' days')::interval
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_cert FROM novos;

  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'pagamento',
      'plano_expirado_ainda_ativo',
      'atencao',
      'Plano "' || coalesce(pl.tipo, 'sem nome') || '" de ' || coalesce(a.nome, 'aluno sem nome') ||
        ' venceu em ' || to_char(pl.data_fim, 'DD/MM/YYYY') || ' (há ' ||
        (current_date - pl.data_fim)::text || ' dias) e continua marcado como ativo, sem plano sucessor.',
      pl.aluno_id,
      jsonb_build_object('plano_id', pl.id, 'aluno_id', pl.aluno_id)
    FROM public.planos pl
    JOIN public.alunos a ON a.id = pl.aluno_id
    WHERE pl.ativo = true
      AND pl.data_fim IS NOT NULL
      AND pl.data_fim < current_date - 3
      AND pl.data_fim >= current_date - interval '12 months'
      AND NOT EXISTS (
        SELECT 1 FROM public.contratos ct
        WHERE ct.plano_id = pl.id
          AND ct.status IN ('cancelado', 'encerrado')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.planos p2
        WHERE p2.aluno_id = pl.aluno_id
          AND p2.id <> pl.id
          AND coalesce(p2.atividade, '') = coalesce(pl.atividade, '')
          AND (
            p2.created_at > pl.created_at
            OR (p2.data_inicio IS NOT NULL AND pl.data_inicio IS NOT NULL AND p2.data_inicio > pl.data_inicio)
          )
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_plano_exp FROM novos;

  RETURN jsonb_build_object(
    'cobranca_sem_contrato_ativo', v_sem_contrato,
    'valor_divergente_plano', v_valor,
    'cobranca_pendente_sem_retry', v_pendente,
    'certificado_vencendo', v_cert,
    'plano_expirado_ainda_ativo', v_plano_exp,
    'executado_em', now()
  );
END;
$function$;