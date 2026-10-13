CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ja_aprovado(p_proposta_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.checkout_2027_tentativas WHERE proposta_id = p_proposta_id AND status = 'aprovado')
$$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_ja_aprovado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_ja_aprovado(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pagamento_iniciar(p_proposta_id uuid, p_chave text, p_tipo text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027; c jsonb; t public.checkout_2027_tentativas;
  v_teste boolean; v_modo text; v_max int; v_total int; v_valor int; v_simulado boolean; v_parc int; n int;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout = 'paga' OR public.fn_checkout_2027_ja_aprovado(r.id) THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF r.etapa_checkout NOT IN ('contrato_aceito','aguardando_pagamento','falhou') OR r.aceite_id IS NULL THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  c := public.fn_checkout_2027_calcular(p_proposta_id);
  IF (c->>'total_centavos') IS DISTINCT FROM (r.revisao->>'total_centavos')
     OR (c->>'forma_plano') IS DISTINCT FROM (r.revisao->>'forma_plano')
     OR (c->>'parcelas_plano') IS DISTINCT FROM (r.revisao->>'parcelas_plano') THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  IF p_tipo NOT IN ('pix','cartao') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF p_tipo = 'pix' AND c->>'forma_plano' <> 'pix_vista' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF p_tipo = 'cartao' AND c->>'forma_plano' <> 'cartao_parcelado' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;

  IF p_tipo = 'pix' THEN
    SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='pix' AND status='pendente'
      AND expira_em > now() ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('reutilizada', true); END IF;
  ELSE
    SELECT count(*) INTO n FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao' AND created_at > now() - interval '30 minutes';
    IF n >= 3 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  END IF;

  v_total := (c->>'total_centavos')::int;
  v_parc := CASE WHEN p_tipo = 'cartao' THEN greatest(1, least(12, coalesce((c->>'parcelas_plano')::int, 1))) ELSE 1 END;
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT (valor #>> '{}')::int INTO v_max FROM public.sistema_config WHERE chave = 'planos_teste_valor_max_centavos';
  v_modo := coalesce(v_modo, 'simulacao'); v_max := least(coalesce(v_max, 100), 100);

  IF v_teste OR NOT public.fn_checkout_2027_ativo() THEN
    IF v_modo = 'real_baixo_valor' AND v_teste THEN
      v_simulado := false; v_valor := least(v_total, v_max); v_parc := 1;
      UPDATE public.sistema_config SET valor = to_jsonb('simulacao'::text), updated_at = now() WHERE chave = 'planos_pagamento_modo_teste';
    ELSE
      v_simulado := true; v_valor := v_total;
    END IF;
  ELSE
    v_simulado := false; v_valor := v_total;
  END IF;

  INSERT INTO public.checkout_2027_tentativas(proposta_id, aceite_id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, expira_em)
  VALUES (r.id, r.aceite_id, p_tipo, v_simulado, v_valor, v_total, v_parc, CASE WHEN p_tipo='pix' THEN now() + interval '30 minutes' END)
  RETURNING * INTO t;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='aguardando_pagamento', etapa_atualizada_em=now() WHERE id = r.id;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('reutilizada', false);
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid,text,text,text) TO service_role;