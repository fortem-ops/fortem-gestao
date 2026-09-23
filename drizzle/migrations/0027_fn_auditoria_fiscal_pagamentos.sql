CREATE OR REPLACE FUNCTION public.fn_auditoria_fiscal_pagamentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sem_contrato int := 0;
  v_valor int := 0;
  v_pendente int := 0;
  v_cert int := 0;
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

  -- 2) Valor da cobrança diferente do valor vigente do plano do aluno
  WITH novos AS (
    INSERT INTO public.auditoria_inconsistencias
      (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT
      'pagamento',
      'valor_divergente_plano',
      'atencao',
      'Cobrança de ' || to_char(c.valor, 'FM999999990.00') || ' (venc. ' ||
        to_char(c.data_vencimento, 'DD/MM/YYYY') || ') difere do valor do plano ativo (' ||
        to_char(p.valor, 'FM999999990.00') || ').',
      c.aluno_id,
      jsonb_build_object('cobranca_id', c.id, 'plano_id', p.id, 'aluno_id', c.aluno_id)
    FROM public.cobrancas c
    JOIN LATERAL (
      SELECT pl.id, pl.valor
      FROM public.planos pl
      WHERE pl.aluno_id = c.aluno_id AND pl.ativo = true AND pl.valor IS NOT NULL AND pl.valor > 0
      ORDER BY pl.data_inicio DESC
      LIMIT 1
    ) p ON true
    WHERE c.data_vencimento >= current_date - interval '90 days'
      AND c.status <> 'cancelado'
      AND abs(c.valor - p.valor) > 0.01
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

  RETURN jsonb_build_object(
    'cobranca_sem_contrato_ativo', v_sem_contrato,
    'valor_divergente_plano', v_valor,
    'cobranca_pendente_sem_retry', v_pendente,
    'certificado_vencendo', v_cert,
    'executado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auditoria_fiscal_pagamentos() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_auditoria_fiscal_pagamentos() TO service_role;