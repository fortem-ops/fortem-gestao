-- Plano Semestral: o retorno do cancelamento conta as mensalidades em aberto antes de cancelar
-- (outro gatilho do contrato já pode cancelá-las ao gravar data_cancelamento).
CREATE OR REPLACE FUNCTION public.fn_semestral_cancelar(p_contrato uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_venda uuid; n_m int := 0; n_c int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Só administrador cancela o Plano Semestral'; END IF;
  SELECT * INTO k FROM public.contratos WHERE id = p_contrato AND plano_tipo = 'semestral_2027' FOR UPDATE;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contrato do Plano Semestral não encontrado'; END IF;
  IF k.data_cancelamento IS NOT NULL THEN RETURN jsonb_build_object('cancelado', true, 'repetido', true, 'acesso_ate', k.data_fim); END IF;
  SELECT id INTO v_venda FROM public.vendas WHERE plano_id = k.plano_id AND tipo = 'plano' ORDER BY created_at LIMIT 1;
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_mensalidades:'||v_venda::text,0));
  IF EXISTS (SELECT 1 FROM public.planos_2027_mensalidades WHERE venda_origem_id = v_venda AND status IN ('processando','desconhecido')) THEN
    RAISE EXCEPTION 'Há uma cobrança no cartão em processamento; aguarde o resultado antes de cancelar';
  END IF;
  SELECT count(*) INTO n_m FROM public.planos_2027_mensalidades WHERE venda_origem_id = v_venda AND status IN ('pendente','recusado','inadimplente');
  SELECT count(*) INTO n_c FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo > 1 AND status IN ('pendente','atrasado');
  UPDATE public.contratos SET data_cancelamento = v_hoje, multa_percentual = 0,
    motivo_cancelamento = COALESCE(NULLIF(p_motivo, ''), 'Cancelamento do Plano Semestral (sem multa)'),
    observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado em ' || v_hoje || ' sem multa; acesso até ' || k.data_fim
  WHERE id = k.id;
  UPDATE public.planos_2027_mensalidades SET status = 'cancelado', proxima_tentativa_em = NULL
   WHERE venda_origem_id = v_venda AND status IN ('pendente','recusado','inadimplente');
  UPDATE public.cobrancas SET status = 'cancelado'
   WHERE contrato_id = k.id AND numero_ciclo > 1 AND status IN ('pendente','atrasado');
  UPDATE public.planos SET renovacao_automatica = false, data_fim = k.data_fim WHERE id = k.plano_id;
  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'cancelado', 'Plano Semestral cancelado sem multa',
    jsonb_build_object('contrato_id', k.id, 'por', auth.uid(), 'acesso_ate', k.data_fim, 'mensalidades_canceladas', n_m));
  RETURN jsonb_build_object('cancelado', true, 'acesso_ate', k.data_fim, 'mensalidades_canceladas', n_m, 'cobrancas_canceladas', n_c, 'multa', 0);
END $$;
REVOKE ALL ON FUNCTION public.fn_semestral_cancelar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_semestral_cancelar(uuid, text) TO authenticated, service_role;