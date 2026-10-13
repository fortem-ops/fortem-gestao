CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_real(p_proposta_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_modo text; v_flag text;
BEGIN
  IF public.fn_checkout_2027_cartao_simulado(p_proposta_id) THEN RETURN false; END IF;
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT valor #>> '{}' INTO v_flag FROM public.sistema_config WHERE chave = 'planos_cartao_real_ativo';
  RETURN (public.fn_checkout_2027_teste(p_proposta_id) AND coalesce(v_modo,'simulacao') = 'real_baixo_valor')
      OR coalesce(v_flag,'false') = 'true';
END $$;

-- Reserva uma tentativa real de cartão com lock: nunca duas em andamento por proposta.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_reservar(p_proposta_id uuid, p_chave text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.propostas_planos_2027; t public.checkout_2027_tentativas; j jsonb;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  PERFORM 1 FROM public.propostas_planos_2027 WHERE id = r.id FOR UPDATE;
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao'
    AND status IN ('processando','desconhecido') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', true); END IF;
  j := public.fn_checkout_2027_pagamento_iniciar(p_proposta_id, p_chave, 'cartao', p_ip);
  IF (j->>'simulado')::boolean THEN RETURN j; END IF;
  UPDATE public.checkout_2027_tentativas SET status='processando', motivo='token_pendente', updated_at=now()
   WHERE id = (j->>'id')::uuid RETURNING * INTO t;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', false);
END $$;

-- Resultado não aprovado do cartão real: proposta continua aguardando_pagamento (nunca "falhou").
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_resultado(p_tentativa_id uuid, p_status text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.checkout_2027_tentativas;
BEGIN
  IF p_status NOT IN ('recusado','expirado','desconhecido') THEN RAISE EXCEPTION 'status inválido'; END IF;
  UPDATE public.checkout_2027_tentativas SET status=p_status, motivo=left(p_motivo,120), updated_at=now()
   WHERE id = p_tentativa_id AND tipo='cartao' AND NOT simulado AND status IN ('processando','desconhecido')
   RETURNING * INTO t;
  IF NOT FOUND THEN SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id; END IF;
  RETURN public.fn_checkout_2027_tentativa_json(t);
END $$;

-- Baixa do cartão real, idempotente (um approved por proposta).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_liquidado(p_tentativa_id uuid, p_tid text, p_nsu text, p_autorizacao text,
  p_return_code text, p_valor_centavos integer, p_parcelas integer, p_raw jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.checkout_2027_tentativas; v_mask text;
BEGIN
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id AND tipo='cartao' AND NOT simulado FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('resultado','nao_encontrado'); END IF;
  IF t.status = 'aprovado' THEN RETURN jsonb_build_object('resultado','ja_processado','proposta_id',t.proposta_id); END IF;
  IF p_valor_centavos IS DISTINCT FROM t.valor_centavos OR p_parcelas IS DISTINCT FROM t.parcelas THEN
    RETURN jsonb_build_object('resultado','valor_divergente'); END IF;
  v_mask := CASE WHEN length(coalesce(p_tid,'')) > 4 THEN repeat('*', length(p_tid)-4) || right(p_tid,4) ELSE p_tid END;
  INSERT INTO public.pagamentos_rede(proposta_id, amount, installments, kind, tid, nsu, authorization_code, return_code, status, raw_response, idempotency_key)
  VALUES (t.proposta_id, t.valor_centavos, t.parcelas, 'token', p_tid, p_nsu, p_autorizacao, p_return_code, 'approved', p_raw,
          'planos:' || t.proposta_id || ':' || coalesce(t.aceite_id::text,'') || ':' || t.id)
  ON CONFLICT DO NOTHING;
  UPDATE public.checkout_2027_tentativas SET status='aprovado', ref=p_tid, motivo=NULL, updated_at=now() WHERE id=t.id;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='paga', pago_em=now(), pagamento_tipo='cartao', pagamento_ref=p_tid,
    pagamento_parcelas=t.parcelas, pagamento_nsu=p_nsu, pagamento_tid_mascarado=v_mask, etapa_atualizada_em=now()
   WHERE id = t.proposta_id AND pago_em IS NULL;
  BEGIN
    PERFORM public.fn_checkout_2027_pos_pagamento(t.proposta_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.propostas_planos_2027 SET lead_erro = coalesce(lead_erro || ' | ', '') || 'aviso pagamento: ' || left(SQLERRM, 200) WHERE id = t.proposta_id;
  END;
  RETURN jsonb_build_object('resultado','baixado','proposta_id',t.proposta_id);
END $$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_real(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_resultado(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_liquidado(uuid, text, text, text, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_real(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_resultado(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_liquidado(uuid, text, text, text, text, integer, integer, jsonb) TO service_role;