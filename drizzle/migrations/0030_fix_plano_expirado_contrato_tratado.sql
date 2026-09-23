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
  -- 1) Cobrança referenciando contrato que não estava vigente na data da cobrança
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

  -- 2) Valor da cobrança diferente do valor vigente (contrato e plano principal VIGENTE)
  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'pagamento',
      'valor_divergente_plano',
      'atencao',
      'Cobrança de ' || to_char(c.valor, 'FM999999990.00') || ' (venc. ' ||
        to_char(c.data_vencimento, 'DD/MM/YYYY') || ') difere do valor contratado (' ||
        to_char(ct.valor_cobrado, 'FM999999990.00') || ') e do valor mensal do plano vigente (' ||
        to_char(p.valor_mensal, 'FM999999990.00') || ').',
      c.aluno_id,
      jsonb_build_object('cobranca_id', c.id, 'contrato_id', ct.id, 'plano_id', p.id, 'aluno_id', c.aluno_id)
    FROM public.cobrancas c
    JOIN public.contratos ct ON ct.id = c.contrato_id
    JOIN LATERAL (
      SELECT pp.id,
             CASE WHEN coalesce(pp.duracao_meses, 0) > 1 THEN pp.valor / pp.duracao_meses ELSE pp.valor END AS valor_mensal
      FROM public.fn_plano_principal_ativo(c.aluno_id) pp
      WHERE pp.id IS NOT NULL
        AND pp.ativo = true
        AND (pp.data_fim IS NULL OR pp.data_fim >= current_date)
        AND pp.valor IS NOT NULL
        AND pp.valor > 0
    ) p ON true
    WHERE c.data_vencimento >= current_date - interval '90 days'
      AND c.status <> 'cancelado'
      AND abs(c.valor - coalesce(ct.valor_cobrado, 0)) > 0.01
      AND abs(c.valor - p.valor_mensal) > 0.01
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_valor FROM novos;

  -- 3) Cobrança pendente há mais de 5 dias sem registro de falha/retry
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

  -- 4) Certificado de integração próximo do vencimento
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

  -- 5) Plano expirado mas ainda marcado como ativo, sem sucessor
  --    e sem contrato vinculado já cancelado/encerrado (caso já tratado pela equipe)
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