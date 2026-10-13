ALTER TABLE public.propostas_planos_2027 ADD COLUMN IF NOT EXISTS notificacao_cartao_recusado_id uuid;

-- Cartão real cobre só: plano em cartão até 12x com as consultas juntas (ou sem consultas), ou consultas sozinhas até 6x.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_elegivel(c jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN c->>'forma_plano' = 'cartao_parcelado' THEN
      coalesce((c->>'parcelas_plano')::int, 0) BETWEEN 1 AND 12
      AND (coalesce((c->>'servicos_centavos')::int, 0) = 0 OR c->>'forma_servicos' IS NULL)
    WHEN c->>'forma_plano' IS NULL THEN
      c->>'forma_servicos' = 'cartao_parcelado' AND coalesce((c->>'parcelas_servicos')::int, 0) BETWEEN 1 AND 6
    ELSE false END
$$;

-- Real só com a flag ligada; proposta de teste ainda exige o modo real_baixo_valor (teto aplicado em pagamento_iniciar).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_real(p_proposta_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_modo text; v_flag text; v_rev jsonb;
BEGIN
  IF public.fn_checkout_2027_cartao_simulado(p_proposta_id) THEN RETURN false; END IF;
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT valor #>> '{}' INTO v_flag FROM public.sistema_config WHERE chave = 'planos_cartao_real_ativo';
  SELECT revisao INTO v_rev FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  RETURN coalesce(v_flag,'false') = 'true'
     AND (NOT public.fn_checkout_2027_teste(p_proposta_id) OR coalesce(v_modo,'simulacao') = 'real_baixo_valor')
     AND public.fn_checkout_2027_cartao_elegivel(v_rev);
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_reservar(p_proposta_id uuid, p_chave text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.propostas_planos_2027; t public.checkout_2027_tentativas; j jsonb;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  PERFORM 1 FROM public.propostas_planos_2027 WHERE id = r.id FOR UPDATE;
  IF NOT public.fn_checkout_2027_cartao_real(r.id) THEN RAISE EXCEPTION 'Pagamento por cartão indisponível no momento'; END IF;
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao'
    AND status IN ('processando','desconhecido') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', true); END IF;
  j := public.fn_checkout_2027_pagamento_iniciar(p_proposta_id, p_chave, 'cartao', p_ip);
  IF (j->>'simulado')::boolean THEN RETURN j; END IF;
  UPDATE public.checkout_2027_tentativas SET status='processando', motivo='token_pendente', updated_at=now()
   WHERE id = (j->>'id')::uuid RETURNING * INTO t;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', false);
END $$;

-- Aviso interno de cartão recusado: uma vez por proposta, sem CPF completo nem dados do cartão.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_recusado_aviso(p_proposta_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.propostas_planos_2027; d jsonb; v_criador uuid; v_notif uuid; v_vinc text;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND OR r.notificacao_cartao_recusado_id IS NOT NULL OR r.pago_em IS NOT NULL THEN RETURN; END IF;
  d := public.fn_checkout_2027_email_dados(p_proposta_id);
  SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF d IS NULL OR v_criador IS NULL THEN RETURN; END IF;
  v_vinc := CASE d->>'vinculo' WHEN 'aluno' THEN 'aluno vinculado (verificado por e-mail)'
    WHEN 'suspeito' THEN 'possível cadastro existente, confira' ELSE 'novo cadastro' END;
  INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (
    CASE WHEN r.teste_admin THEN '[TESTE] ' ELSE '' END || 'Cartão recusado no site: ' || coalesce(d->>'nome', 'sem nome'),
    coalesce(d->>'plano','') || ' ' || coalesce(d->>'frequencia','') || E'\n'
      || 'Forma escolhida: Cartão em ' || coalesce(r.parcelas_plano, 1) || 'x · Total R$ '
      || translate(to_char((d->>'total_centavos')::numeric / 100, 'FM999,999,990.00'), ',.', '.,') || E'\n'
      || 'Vínculo: ' || v_vinc || E'\n'
      || 'CPF final ' || coalesce(d->>'cpf_ultimos3', '---') || ' · WhatsApp ' || coalesce(d->>'whatsapp', '-') || E'\n\n'
      || CASE WHEN r.teste_admin THEN 'Teste de admin: não ativar nada.' ELSE 'Ação: entrar em contato para ajudar a concluir o pagamento.' END,
    'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
  UPDATE public.propostas_planos_2027 SET notificacao_cartao_recusado_id = v_notif WHERE id = p_proposta_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_resultado(p_tentativa_id uuid, p_status text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.checkout_2027_tentativas;
BEGIN
  IF p_status NOT IN ('recusado','expirado','desconhecido') THEN RAISE EXCEPTION 'status inválido'; END IF;
  UPDATE public.checkout_2027_tentativas SET status=p_status, motivo=left(p_motivo,120), updated_at=now()
   WHERE id = p_tentativa_id AND tipo='cartao' AND NOT simulado AND status IN ('processando','desconhecido')
   RETURNING * INTO t;
  IF NOT FOUND THEN SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id;
  ELSIF p_status = 'recusado' THEN
    BEGIN PERFORM public.fn_checkout_2027_cartao_recusado_aviso(t.proposta_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN public.fn_checkout_2027_tentativa_json(t);
END $$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_elegivel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_recusado_aviso(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_real(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_resultado(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_elegivel(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_recusado_aviso(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_real(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_resultado(uuid, text, text) TO service_role;