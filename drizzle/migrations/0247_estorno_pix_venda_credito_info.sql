CREATE OR REPLACE FUNCTION public.fn_estorno_pix_venda_resultado(_estorno_id uuid, _status text, _e2e text, _retorno jsonb, _motivo text, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e public.estornos_pix_venda%ROWTYPE; v public.vendas%ROWTYPE; _ctl record; _c record; _usado int := null; _retirado boolean := null;
BEGIN
  IF _status NOT IN ('devolvido','recusado','desconhecido') THEN RAISE EXCEPTION 'status inválido'; END IF;
  IF _user_id IS NULL OR NOT public.is_admin(_user_id) THEN RAISE EXCEPTION 'apenas administradores'; END IF;
  SELECT * INTO e FROM public.estornos_pix_venda WHERE id = _estorno_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Devolução não encontrada.'); END IF;
  IF e.status = 'devolvido' THEN RETURN jsonb_build_object('ok', true, 'ja_registrado', true, 'credito_usado', e.credito_usado, 'credito_retirado', e.credito_retirado); END IF;
  UPDATE public.estornos_pix_venda SET status = _status, e2e_id = coalesce(_e2e, e2e_id), retorno = _retorno, motivo = coalesce(_motivo, motivo), updated_at = now() WHERE id = e.id;
  IF _status = 'devolvido' THEN
    SELECT * INTO v FROM public.vendas WHERE id = e.venda_id FOR UPDATE;
    SELECT * INTO _ctl FROM public.vendas_creditos_pos_pagamento WHERE venda_id = v.id;
    IF FOUND THEN
      SELECT * INTO _c FROM public.creditos_aluno WHERE id = _ctl.credito_id;
      IF FOUND THEN _usado := _c.quantidade_usada; _retirado := (_c.quantidade_usada < _c.quantidade_inicial) AND _ctl.retirado_em IS NULL; END IF;
    END IF;
    UPDATE public.pix_cobrancas SET status = 'DEVOLVIDA' WHERE txid = e.txid AND liquidado_em IS NOT NULL;
    -- O gatilho trg_vendas_credito_apos_pagamento retira só o crédito ainda não usado.
    UPDATE public.vendas SET status_pagamento = 'estornado' WHERE id = v.id AND status_pagamento = 'pago';
    UPDATE public.estornos_pix_venda SET credito_usado = _usado, credito_retirado = _retirado WHERE id = e.id;
    BEGIN
      INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
      VALUES ('vendas', v.id::text, 'estorno', _user_id,
        jsonb_build_object('status_pagamento', v.status_pagamento, 'valor', v.valor_final, 'txid', e.txid),
        jsonb_build_object('status_pagamento', 'estornado', 'valor_estornado', e.valor_centavos / 100.0, 'meio', 'pix',
          'e2e_id', coalesce(_e2e, e.e2e_id), 'devolucao_id', e.devolucao_id, 'motivo', _motivo,
          'estorno_pix_venda_id', e.id, 'credito_usado', _usado, 'credito_retirado', _retirado));
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'audit estorno pix venda: %', SQLERRM; END;
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', _status, 'valor_estornado', e.valor_centavos / 100.0, 'credito_usado', _usado, 'credito_retirado', _retirado);
END $function$;