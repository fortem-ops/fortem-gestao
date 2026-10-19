CREATE OR REPLACE FUNCTION public.fn_reativar_contrato(_contrato_id uuid, _nova_data_fim date, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.contratos%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO c FROM public.contratos WHERE id = _contrato_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF c.status <> 'encerrado' THEN RAISE EXCEPTION 'Só contratos encerrados podem ser reativados'; END IF;
  IF _nova_data_fim IS NULL OR (c.data_fim IS NOT NULL AND _nova_data_fim <= c.data_fim) THEN
    RAISE EXCEPTION 'A nova data de término precisa ser depois do término atual';
  END IF;
  UPDATE public.contratos SET status = 'ativo', data_fim = _nova_data_fim WHERE id = _contrato_id;
  IF c.plano_id IS NOT NULL THEN
    UPDATE public.planos SET ativo = true, data_fim = _nova_data_fim, proxima_renovacao = _nova_data_fim WHERE id = c.plano_id;
  END IF;
  INSERT INTO public.audit_log(tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('contratos', _contrato_id::text, 'REATIVAR', auth.uid(),
    jsonb_build_object('status', c.status, 'data_fim', c.data_fim),
    jsonb_build_object('status', 'ativo', 'data_fim', _nova_data_fim, 'motivo', _motivo));
  RETURN jsonb_build_object('ok', true, 'data_fim_anterior', c.data_fim, 'data_fim', _nova_data_fim);
END $$;
REVOKE ALL ON FUNCTION public.fn_reativar_contrato(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reativar_contrato(uuid, date, text) TO authenticated;