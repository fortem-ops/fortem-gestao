-- Tentativa em andamento é devolvida antes da trava: o modo de teste volta a "simulacao" depois do 1º uso real.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_reservar(p_proposta_id uuid, p_chave text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.propostas_planos_2027; t public.checkout_2027_tentativas; j jsonb;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  PERFORM 1 FROM public.propostas_planos_2027 WHERE id = r.id FOR UPDATE;
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao'
    AND status IN ('processando','desconhecido') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', true); END IF;
  IF NOT public.fn_checkout_2027_cartao_real(r.id) THEN RAISE EXCEPTION 'Pagamento por cartão indisponível no momento'; END IF;
  j := public.fn_checkout_2027_pagamento_iniciar(p_proposta_id, p_chave, 'cartao', p_ip);
  IF (j->>'simulado')::boolean THEN RETURN j; END IF;
  UPDATE public.checkout_2027_tentativas SET status='processando', motivo='token_pendente', updated_at=now()
   WHERE id = (j->>'id')::uuid RETURNING * INTO t;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', false);
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) TO service_role;