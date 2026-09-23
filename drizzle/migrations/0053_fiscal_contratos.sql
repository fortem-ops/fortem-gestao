CREATE OR REPLACE FUNCTION public.fn_auditoria_fiscal_contratos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_pend int := 0; v_sem int := 0; v_res int := 0;
BEGIN
  -- Resolve alertas abertos que não se aplicam mais (aceite registrado, documento criado ou contrato encerrado)
  WITH r AS (
    UPDATE public.auditoria_inconsistencias ai
       SET status = 'resolvido', resolvido_em = now(),
           nota_resolucao = 'Resolvido automaticamente: aceite/documento registrado ou contrato não está mais ativo.'
     WHERE ai.categoria = 'contratos' AND ai.status = 'aberto'
       AND NOT EXISTS (
         SELECT 1 FROM public.contratos c
         WHERE c.id = (ai.registros_afetados->>'contrato_id')::uuid
           AND c.status IN ('ativo','suspenso')
           AND NOT EXISTS (SELECT 1 FROM public.contratos_documentos d WHERE d.contrato_id = c.id AND d.aceite)
           AND (ai.subtipo <> 'contrato_sem_documento'
                OR NOT EXISTS (SELECT 1 FROM public.contratos_documentos d WHERE d.contrato_id = c.id)))
    RETURNING 1)
  SELECT count(*) INTO v_res FROM r;

  WITH base AS (
    SELECT c.id AS contrato_id, c.aluno_id, c.status, c.plano_tipo, c.created_at AS contrato_criado,
      d.id AS documento_id, d.created_at AS doc_criado,
      EXISTS (SELECT 1 FROM public.links_contrato l WHERE l.contrato_documento_id = d.id) AS tem_link,
      EXISTS (SELECT 1 FROM public.links_contrato l WHERE l.contrato_documento_id = d.id AND l.expira_em < now() AND NOT l.usado) AS link_expirado
    FROM public.contratos c
    LEFT JOIN LATERAL (SELECT * FROM public.contratos_documentos x WHERE x.contrato_id = c.id
                       ORDER BY x.aceite DESC, x.created_at DESC LIMIT 1) d ON true
    WHERE c.status IN ('ativo','suspenso')
      AND coalesce(c.plano_tipo, '') NOT IN ('totalpass','gympass')
      AND NOT EXISTS (SELECT 1 FROM public.contratos_documentos x WHERE x.contrato_id = c.id AND x.aceite)
  ),
  n1 AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'contratos', 'aceite_pendente',
      CASE WHEN b.doc_criado < now() - interval '30 days' AND b.status = 'ativo' THEN 'critico' ELSE 'atencao' END,
      'Contrato ' || coalesce(b.plano_tipo, '') || ' sem aceite do aluno — documento gerado em ' ||
        to_char(b.doc_criado AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || ' (' ||
        (current_date - (b.doc_criado AT TIME ZONE 'America/Sao_Paulo')::date) || ' dias).' ||
        CASE WHEN NOT b.tem_link THEN ' Nenhum link de aceite enviado.' WHEN b.link_expirado THEN ' Link de aceite expirado.' ELSE '' END,
      b.aluno_id,
      jsonb_build_object('contrato_id', b.contrato_id, 'documento_id', b.documento_id, 'aluno_id', b.aluno_id,
        'faixa', CASE WHEN b.doc_criado < now() - interval '30 days' AND b.status = 'ativo' THEN 'mais_30' ELSE 'ate_30' END)
    FROM base b
    WHERE b.documento_id IS NOT NULL AND b.doc_criado < now() - interval '7 days'
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_pend FROM n1;

  -- Ao virar crítico, o alerta de atenção anterior é substituído
  UPDATE public.auditoria_inconsistencias a
     SET status = 'resolvido', resolvido_em = now(), nota_resolucao = 'Substituído por alerta crítico (mais de 30 dias sem aceite).'
   WHERE a.categoria = 'contratos' AND a.subtipo = 'aceite_pendente' AND a.status = 'aberto'
     AND a.registros_afetados->>'faixa' = 'ate_30'
     AND EXISTS (SELECT 1 FROM public.auditoria_inconsistencias b WHERE b.categoria = 'contratos' AND b.subtipo = 'aceite_pendente'
                 AND b.status = 'aberto' AND b.registros_afetados->>'faixa' = 'mais_30'
                 AND b.registros_afetados->>'contrato_id' = a.registros_afetados->>'contrato_id');

  WITH n2 AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'contratos', 'contrato_sem_documento', 'atencao',
      'Contrato ' || coalesce(c.plano_tipo, '') || ' (' || c.status || ', criado em ' ||
        to_char(c.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || ') sem documento de contrato gerado nem aceite registrado.',
      c.aluno_id,
      jsonb_build_object('contrato_id', c.id, 'aluno_id', c.aluno_id)
    FROM public.contratos c
    WHERE c.status IN ('ativo','suspenso')
      AND coalesce(c.plano_tipo, '') NOT IN ('totalpass','gympass')
      AND NOT EXISTS (SELECT 1 FROM public.contratos_documentos d WHERE d.contrato_id = c.id)
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_sem FROM n2;

  RETURN jsonb_build_object('aceite_pendente', v_pend, 'contrato_sem_documento', v_sem,
    'contratos_resolvidos_auto', v_res, 'executado_em', now());
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_auditoria_fiscal_contratos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_auditoria_fiscal_contratos() TO service_role;

SELECT cron.alter_job(33, command := 'SELECT public.fn_auditoria_fiscal_pagamentos(); SELECT public.fn_auditoria_fiscal_creditos(); SELECT public.fn_auditoria_fiscal_agenda_servicos(); SELECT public.fn_auditoria_fiscal_pipeline(); SELECT public.fn_auditoria_fiscal_contratos();');