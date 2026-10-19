CREATE OR REPLACE FUNCTION public.fn_registrar_motivo_edicao_cobranca(p_cobranca_ids uuid[], p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF coalesce(length(trim(p_motivo)),0) < 3 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  INSERT INTO audit_log(tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  SELECT 'cobrancas', id, 'update', auth.uid(), NULL,
         jsonb_build_object('acao','editar_cobranca_paga','motivo', trim(p_motivo))
  FROM unnest(p_cobranca_ids) AS id;
END $$;
REVOKE ALL ON FUNCTION public.fn_registrar_motivo_edicao_cobranca(uuid[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_motivo_edicao_cobranca(uuid[], text) TO authenticated;