CREATE TABLE public.estornos_pix_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  status text NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado','devolvido','recusado','desconhecido')),
  txid text NOT NULL,
  e2e_id text,
  devolucao_id text NOT NULL,
  motivo text,
  retorno jsonb,
  credito_usado integer,
  credito_retirado boolean,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX estornos_pix_venda_ativo_uniq ON public.estornos_pix_venda (venda_id) WHERE status IN ('reservado','devolvido','desconhecido');
GRANT SELECT ON public.estornos_pix_venda TO authenticated;
GRANT ALL ON public.estornos_pix_venda TO service_role;
ALTER TABLE public.estornos_pix_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem devolucoes pix de venda" ON public.estornos_pix_venda FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_estorno_pix_venda_reservar(_venda_id uuid, _idempotency_key text, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.vendas%ROWTYPE; e public.estornos_pix_venda%ROWTYPE; pc public.pix_cobrancas%ROWTYPE; v_id uuid := gen_random_uuid();
BEGIN
  IF _user_id IS NULL OR NOT public.is_admin(_user_id) THEN RETURN jsonb_build_object('ok', false, 'erro', 'Apenas administradores podem devolver Pix.'); END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 10 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência inválida.'); END IF;
  SELECT * INTO e FROM public.estornos_pix_venda WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('ok', false, 'duplicado', true, 'status', e.status, 'erro', 'Esta devolução já foi enviada. Aguarde o resultado antes de tentar de novo.'); END IF;
  SELECT * INTO v FROM public.vendas WHERE id = _venda_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Venda não encontrada.'); END IF;
  IF v.origem IS DISTINCT FROM 'portal_avulso' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só compras avulsas do portal podem ser devolvidas por aqui.'); END IF;
  IF v.status_pagamento <> 'pago' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só é possível devolver uma venda paga.'); END IF;
  SELECT * INTO pc FROM public.pix_cobrancas WHERE corrida_venda_id = v.id AND liquidado_em IS NOT NULL ORDER BY liquidado_em DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Pix recebido não encontrado para esta venda.'); END IF;
  IF EXISTS (SELECT 1 FROM public.estornos_pix_venda WHERE venda_id = v.id AND status IN ('reservado','devolvido','desconhecido')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta venda já tem devolução feita ou em conferência.');
  END IF;
  INSERT INTO public.estornos_pix_venda (id, venda_id, idempotency_key, valor_centavos, txid, devolucao_id, created_by)
  VALUES (v_id, v.id, _idempotency_key, round(pc.valor * 100)::int, pc.txid, left('dev' || replace(v_id::text, '-', ''), 35), _user_id);
  RETURN jsonb_build_object('ok', true, 'estorno_id', v_id, 'txid', pc.txid, 'valor', pc.valor,
    'devolucao_id', left('dev' || replace(v_id::text, '-', ''), 35), 'aluno_id', v.aluno_id,
    'e2e_salvo', coalesce(pc.raw_response->>'endToEndId', pc.raw_response#>>'{pix,0,endToEndId}'));
END $$;

CREATE OR REPLACE FUNCTION public.fn_estorno_pix_venda_resultado(_estorno_id uuid, _status text, _e2e text, _retorno jsonb, _motivo text, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    IF _ctl IS NOT NULL THEN
      SELECT * INTO _c FROM public.creditos_aluno WHERE id = _ctl.credito_id;
      IF _c IS NOT NULL THEN _usado := _c.quantidade_usada; _retirado := (_c.quantidade_usada < _c.quantidade_inicial) AND _ctl.retirado_em IS NULL; END IF;
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
END $$;

REVOKE ALL ON FUNCTION public.fn_estorno_pix_venda_reservar(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_estorno_pix_venda_resultado(uuid, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estorno_pix_venda_reservar(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_estorno_pix_venda_resultado(uuid, text, text, jsonb, text, uuid) TO service_role;