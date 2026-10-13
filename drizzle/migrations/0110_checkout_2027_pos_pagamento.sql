ALTER TABLE public.propostas_planos_2027
  ADD COLUMN IF NOT EXISTS notificacao_pagamento_id uuid,
  ADD COLUMN IF NOT EXISTS email_confirmacao_reservado_em timestamptz,
  ADD COLUMN IF NOT EXISTS email_confirmacao_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS email_confirmacao_erro text;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_dados(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.propostas_planos_2027; v_plano text; v_serv text;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(nome_exibicao, nome) INTO v_plano FROM public.planos_catalogo WHERE codigo = r.plano_codigo ORDER BY versao DESC NULLS LAST LIMIT 1;
  SELECT string_agg(coalesce(s.nome, c), ', ') INTO v_serv
    FROM unnest(coalesce(r.servicos_codigos, '{}'::text[])) c
    LEFT JOIN LATERAL (SELECT nome FROM public.servicos_catalogo WHERE codigo = c ORDER BY versao DESC NULLS LAST LIMIT 1) s ON true;
  RETURN jsonb_build_object(
    'id', r.id, 'nome', r.nome, 'email', r.email, 'whatsapp', r.whatsapp, 'cpf_ultimos3', r.cpf_ultimos3,
    'plano', coalesce(v_plano, r.familia, r.plano_codigo), 'frequencia', r.frequencia, 'servicos', v_serv,
    'pagamento_tipo', r.pagamento_tipo, 'parcelas', coalesce(r.parcelas_plano, 1),
    'total_centavos', r.valor_total_centavos, 'pago_em', r.pago_em, 'teste_admin', coalesce(r.teste_admin, false),
    'vinculo', CASE WHEN r.aluno_id IS NOT NULL THEN 'aluno' WHEN r.aluno_suspeito_id IS NOT NULL THEN 'suspeito' ELSE 'novo' END,
    'email_enviado_em', r.email_confirmacao_enviado_em);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pos_pagamento(p_proposta_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d jsonb; v_criador uuid; v_notif uuid; v_titulo text; v_desc text; v_forma text; v_vinc text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.propostas_planos_2027 WHERE id = p_proposta_id AND (pago_em IS NULL OR notificacao_pagamento_id IS NOT NULL)) THEN
    RETURN NULL;
  END IF;
  d := public.fn_checkout_2027_email_dados(p_proposta_id);
  IF d IS NULL THEN RETURN NULL; END IF;
  SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_criador IS NULL THEN RETURN NULL; END IF;
  v_forma := CASE WHEN d->>'pagamento_tipo' = 'pix' THEN 'Pix à vista' ELSE 'Cartão em ' || (d->>'parcelas') || 'x' END;
  v_vinc := CASE d->>'vinculo' WHEN 'aluno' THEN 'aluno vinculado (verificado por e-mail)'
    WHEN 'suspeito' THEN 'possível cadastro existente, confira' ELSE 'novo cadastro' END;
  v_titulo := CASE WHEN (d->>'teste_admin')::boolean THEN '[TESTE] ' ELSE '' END
    || 'Nova compra do site — pagamento aprovado: ' || coalesce(d->>'nome', 'sem nome');
  v_desc := coalesce(d->>'plano','') || ' ' || coalesce(d->>'frequencia','') || ' · ' || coalesce(d->>'servicos', 'sem serviços') || E'\n'
    || 'Pagamento: ' || v_forma || ' · Total R$ ' || to_char((d->>'total_centavos')::numeric / 100, 'FM999G999D00')
    || ' · aprovado em ' || to_char(((d->>'pago_em')::timestamptz) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || E'\n'
    || 'Vínculo: ' || v_vinc || E'\n'
    || 'CPF final ' || coalesce(d->>'cpf_ultimos3', '---') || ' · WhatsApp ' || coalesce(d->>'whatsapp', '-') || E'\n\n'
    || CASE WHEN (d->>'teste_admin')::boolean THEN 'Teste de admin: não ativar nada.'
       ELSE E'Ativar manualmente:\n1. Criar ou vincular o aluno (confira o vínculo acima)\n2. Criar o plano\n3. Gerar contrato e documentos\n4. Liberar créditos 2027\n5. Lançar mensalidades/recorrência\n6. Configurar reposição (Pro/Treino)\n7. Incluir no Clube' END
    || E'\nVeja em Leads > Propostas do site.';
  INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (v_titulo, v_desc, 'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
  UPDATE public.propostas_planos_2027 SET notificacao_pagamento_id = v_notif WHERE id = p_proposta_id;
  RETURN v_notif;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_reservar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.propostas_planos_2027 SET email_confirmacao_reservado_em = now()
   WHERE id = p_proposta_id AND pago_em IS NOT NULL AND email_confirmacao_enviado_em IS NULL
     AND (email_confirmacao_reservado_em IS NULL OR email_confirmacao_reservado_em < now() - interval '10 minutes');
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.fn_checkout_2027_email_dados(p_proposta_id);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_resultado(p_proposta_id uuid, p_enviado boolean, p_erro text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_enviado THEN
    UPDATE public.propostas_planos_2027 SET email_confirmacao_enviado_em = now(), email_confirmacao_erro = NULL WHERE id = p_proposta_id;
  ELSE
    -- libera a reserva para nova tentativa
    UPDATE public.propostas_planos_2027 SET email_confirmacao_reservado_em = NULL, email_confirmacao_erro = left(p_erro, 300) WHERE id = p_proposta_id;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pix_liquidado(p_txid text, p_valor_centavos integer, p_e2e text, p_raw jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.pix_cobrancas; t public.checkout_2027_tentativas; v_cob integer;
BEGIN
  SELECT * INTO c FROM public.pix_cobrancas
   WHERE txid = p_txid AND proposta_id IS NOT NULL AND pedido_id IS NULL AND corrida_venda_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('resultado','nao_encontrado'); END IF;
  SELECT * INTO t FROM public.checkout_2027_tentativas
   WHERE proposta_id = c.proposta_id AND tipo='pix' AND ref = p_txid ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF c.status = 'LIQUIDADA' AND (t.id IS NULL OR t.status = 'aprovado') THEN
    RETURN jsonb_build_object('resultado','ja_processado','proposta_id',c.proposta_id);
  END IF;
  v_cob := round(c.valor * 100)::integer;
  IF p_valor_centavos IS NULL OR p_valor_centavos <> v_cob THEN
    RETURN jsonb_build_object('resultado','valor_divergente','esperado',v_cob,'recebido',p_valor_centavos);
  END IF;
  UPDATE public.pix_cobrancas SET status='LIQUIDADA', liquidado_em=coalesce(liquidado_em, now()),
    raw_response = coalesce(p_raw, raw_response), updated_at=now() WHERE id = c.id;
  IF t.id IS NOT NULL AND t.status IN ('pendente','expirado') THEN
    UPDATE public.checkout_2027_tentativas SET status='aprovado', motivo=NULL, updated_at=now() WHERE id=t.id;
  END IF;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='paga', pago_em=now(), pagamento_tipo='pix',
    pagamento_ref=p_txid, etapa_atualizada_em=now()
   WHERE id = c.proposta_id AND pago_em IS NULL;
  BEGIN
    PERFORM public.fn_checkout_2027_pos_pagamento(c.proposta_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.propostas_planos_2027 SET lead_erro = coalesce(lead_erro || ' | ', '') || 'aviso pagamento: ' || left(SQLERRM, 200) WHERE id = c.proposta_id;
  END;
  RETURN jsonb_build_object('resultado','baixado','proposta_id',c.proposta_id,'e2e',left(coalesce(p_e2e,''),64));
END $function$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_email_dados(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_pos_pagamento(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_email_reservar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_email_resultado(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_email_dados(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pos_pagamento(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_email_reservar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_email_resultado(uuid, boolean, text) TO service_role;