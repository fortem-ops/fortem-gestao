ALTER TABLE public.propostas_planos_2027 ADD COLUMN IF NOT EXISTS notificacao_cartao_combinar_id uuid;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_simulado(p_proposta_id uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_teste boolean; v_modo text;
BEGIN
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  RETURN (v_teste OR NOT public.fn_checkout_2027_ativo()) AND NOT (coalesce(v_modo, 'simulacao') = 'real_baixo_valor' AND v_teste);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_combinar(p_proposta_id uuid, p_chave text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.propostas_planos_2027; d jsonb; v_criador uuid; v_notif uuid; v_forma text; v_vinc text; v_titulo text; v_desc text;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout NOT IN ('contrato_aceito','aguardando_pagamento','falhou') OR r.aceite_id IS NULL THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  IF r.forma_plano NOT IN ('cartao_parcelado','recorrencia') OR public.fn_checkout_2027_cartao_simulado(r.id) THEN
    RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF r.notificacao_cartao_combinar_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'repetido', true);
  END IF;
  d := public.fn_checkout_2027_email_dados(p_proposta_id);
  SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF d IS NULL OR v_criador IS NULL THEN RETURN jsonb_build_object('ok', true, 'repetido', false); END IF;
  v_forma := CASE WHEN r.forma_plano = 'recorrencia' THEN 'Recorrência no cartão' ELSE 'Cartão em ' || coalesce(r.parcelas_plano, 1) || 'x' END;
  v_vinc := CASE d->>'vinculo' WHEN 'aluno' THEN 'aluno vinculado (verificado por e-mail)'
    WHEN 'suspeito' THEN 'possível cadastro existente, confira' ELSE 'novo cadastro' END;
  v_titulo := CASE WHEN r.teste_admin THEN '[TESTE] ' ELSE '' END
    || 'Proposta aceita — pagamento por cartão a combinar: ' || coalesce(d->>'nome', 'sem nome');
  v_desc := coalesce(d->>'plano','') || ' ' || coalesce(d->>'frequencia','') || E'\n'
    || 'Forma escolhida: ' || v_forma || ' · Total R$ ' || translate(to_char((d->>'total_centavos')::numeric / 100, 'FM999,999,990.00'), ',.', '.,') || E'\n'
    || 'Vínculo: ' || v_vinc || E'\n'
    || 'CPF final ' || coalesce(d->>'cpf_ultimos3', '---') || ' · WhatsApp ' || coalesce(d->>'whatsapp', '-') || E'\n\n'
    || CASE WHEN r.teste_admin THEN 'Teste de admin: não ativar nada.' ELSE 'Ação: entrar em contato para combinar o pagamento.' END;
  INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (v_titulo, v_desc, 'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
  UPDATE public.propostas_planos_2027 SET notificacao_cartao_combinar_id = v_notif WHERE id = p_proposta_id;
  RETURN jsonb_build_object('ok', true, 'repetido', false);
END $function$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_simulado(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_combinar(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_simulado(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_combinar(uuid, text) TO service_role;

-- Turnstile: passe emitido por planos-codigo após verificar o token na Cloudflare.
CREATE TABLE IF NOT EXISTS public.planos_turnstile_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT now() + interval '20 minutes',
  consumido_em timestamptz
);
GRANT ALL ON public.planos_turnstile_passes TO service_role;
ALTER TABLE public.planos_turnstile_passes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sistema_config(chave, valor) VALUES ('planos_turnstile_site_key', to_jsonb('0x4AAAAAAFV-NIyBZ1_8xwlg'::text))
ON CONFLICT (chave) DO NOTHING;

DO $migration$ DECLARE v text; a int; BEGIN
  v := pg_get_functiondef('public.fn_proposta_plano_2027_criar(jsonb)'::regprocedure);
  a := position('  -- Cadastro único: CPF obrigatório' in v);
  IF a = 0 THEN RAISE EXCEPTION 'Unexpected definition'; END IF;
  v := substr(v, 1, a - 1) || E'  -- Turnstile (só público, com a chave ligada): consome um passe emitido pelo servidor.\n'
    || E'  IF NOT v_previa AND coalesce((SELECT valor FROM public.sistema_config WHERE chave = ''planos_turnstile_ativo''), ''false''::jsonb) = ''true''::jsonb THEN\n'
    || E'    IF coalesce(p->>''turnstile_passe'','''') !~ ''^[0-9a-fA-F-]{36}$'' THEN RAISE EXCEPTION ''Confirme a verificação de segurança''; END IF;\n'
    || E'    UPDATE public.planos_turnstile_passes SET consumido_em = now() WHERE id = (p->>''turnstile_passe'')::uuid AND consumido_em IS NULL AND expira_em > now();\n'
    || E'    IF NOT FOUND THEN RAISE EXCEPTION ''Confirme a verificação de segurança''; END IF;\n'
    || E'  END IF;\n'
    || substr(v, a);
  EXECUTE v;
END $migration$;