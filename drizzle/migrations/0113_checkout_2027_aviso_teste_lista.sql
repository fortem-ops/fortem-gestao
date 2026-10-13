CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pos_pagamento(p_proposta_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d jsonb; v_criador uuid; v_notif uuid; v_titulo text; v_desc text; v_forma text; v_vinc text; v_teste boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.propostas_planos_2027 WHERE id = p_proposta_id AND (pago_em IS NULL OR notificacao_pagamento_id IS NOT NULL)) THEN
    RETURN NULL;
  END IF;
  d := public.fn_checkout_2027_email_dados(p_proposta_id);
  IF d IS NULL THEN RETURN NULL; END IF;
  SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_criador IS NULL THEN RETURN NULL; END IF;
  -- [TESTE] para prévia de admin e também para proposta pública de aluno da lista de teste.
  v_teste := coalesce((d->>'teste_admin')::boolean, false) OR public.fn_checkout_2027_teste(p_proposta_id);
  v_forma := CASE WHEN d->>'pagamento_tipo' = 'pix' THEN 'Pix à vista' ELSE 'Cartão em ' || (d->>'parcelas') || 'x' END;
  v_vinc := CASE d->>'vinculo' WHEN 'aluno' THEN 'aluno vinculado (verificado por e-mail)'
    WHEN 'suspeito' THEN 'possível cadastro existente, confira' ELSE 'novo cadastro' END;
  v_titulo := CASE WHEN v_teste THEN '[TESTE] ' ELSE '' END
    || 'Nova compra do site — pagamento aprovado: ' || coalesce(d->>'nome', 'sem nome');
  v_desc := coalesce(d->>'plano','') || ' ' || coalesce(d->>'frequencia','') || ' · ' || coalesce(d->>'servicos', 'sem serviços') || E'\n'
    || 'Pagamento: ' || v_forma || ' · Total R$ ' || translate(to_char((d->>'total_centavos')::numeric / 100, 'FM999,999,990.00'), ',.', '.,')
    || ' · aprovado em ' || to_char(((d->>'pago_em')::timestamptz) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || E'\n'
    || 'Vínculo: ' || v_vinc || E'\n'
    || 'CPF final ' || coalesce(d->>'cpf_ultimos3', '---') || ' · WhatsApp ' || coalesce(d->>'whatsapp', '-') || E'\n\n'
    || CASE WHEN v_teste THEN 'Teste de admin: não ativar nada.'
       ELSE E'Ativar manualmente:\n1. Criar ou vincular o aluno (confira o vínculo acima)\n2. Criar o plano\n3. Gerar contrato e documentos\n4. Liberar créditos 2027\n5. Lançar mensalidades/recorrência\n6. Configurar reposição (Pro/Treino)\n7. Incluir no Clube' END
    || E'\nVeja em Leads > Propostas do site.';
  INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (v_titulo, v_desc, 'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
  UPDATE public.propostas_planos_2027 SET notificacao_pagamento_id = v_notif WHERE id = p_proposta_id;
  RETURN v_notif;
END $function$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_pos_pagamento(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pos_pagamento(uuid) TO service_role;