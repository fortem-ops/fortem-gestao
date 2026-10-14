-- ANEXO I no checkout do /planos + texto da 3ª §7 + maiores de 18.
-- 1. Contratos ativos: troca só a frase da 3ª §7 e sobe a versão (aceites antigos guardam o texto e o hash próprios).
UPDATE public.contrato_templates
   SET conteudo = replace(conteudo, $o$declarando se realizou avaliação médica prévia ou se opta, por sua conta e risco, pela prática de atividades físicas sem avaliação médica recente.$o$, $n$declarando se possui ou não restrições médicas à prática de atividade física, apresentando atestado quando houver restrição.$n$), versao = versao + 1, updated_at = now()
 WHERE ativo AND strpos(conteudo, $o$declarando se realizou avaliação médica prévia ou se opta, por sua conta e risco, pela prática de atividades físicas sem avaliação médica recente.$o$) > 0;

-- 2. Aceite guarda as respostas do ANEXO I, a versão do texto e a assinatura.
ALTER TABLE public.propostas_2027_aceites ADD COLUMN IF NOT EXISTS anexo jsonb, ADD COLUMN IF NOT EXISTS anexo_versao text, ADD COLUMN IF NOT EXISTS anexo_assinatura text;
COMMENT ON COLUMN public.propostas_2027_aceites.anexo IS 'ANEXO I: medical_status ok/restricao, image_usage, contato de emergência, lgpd/termos; nunca CPF.';

-- 3. Contrato: maiores de 18 anos.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_contrato_gerar(p_proposta_id uuid, p_chave text, p jsonb, p_ip text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.propostas_planos_2027; v_calc jsonb; v_t public.contrato_templates; v_item jsonb;
  v_cpf text := regexp_replace(coalesce(p->>'cpf',''),'\D','','g'); v_hash text; v_outro uuid; v_cad_hash text;
  v_cep text := regexp_replace(coalesce(p->>'cep',''),'\D','','g'); v_nasc date; v_c jsonb; v_reg int;
  v_nome text; v_email text;
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ck:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF NOT public.fn_planos_limite('ck:p:'||p_proposta_id::text, 20) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout IN ('aguardando_pagamento','paga') THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF NOT public.fn_cpf_digitos_validos(v_cpf) THEN RAISE EXCEPTION 'CPF inválido. Confira os números'; END IF;
  BEGIN v_nasc := (p->>'data_nascimento')::date; EXCEPTION WHEN OTHERS THEN v_nasc := NULL; END;
  IF v_nasc IS NULL OR v_nasc < date '1900-01-01' OR v_nasc > current_date THEN RAISE EXCEPTION 'Informe uma data de nascimento válida'; END IF;
  -- ANEXO I: compra pelo site só para maiores de 18 anos (menores: equipe pelo WhatsApp).
  IF v_nasc > (current_date - interval '18 years')::date THEN RAISE EXCEPTION 'A compra pelo site é só para maiores de 18 anos. Fale com a equipe FORTEM pelo WhatsApp'; END IF;
  IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'Informe um CEP válido'; END IF;
  IF length(btrim(coalesce(p->>'logradouro',''))) < 3 OR length(btrim(coalesce(p->>'numero',''))) < 1
     OR length(btrim(coalesce(p->>'bairro',''))) < 2 OR length(btrim(coalesce(p->>'cidade',''))) < 2
     OR upper(coalesce(p->>'uf','')) !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Preencha o endereço completo'; END IF;
  -- Nome e e-mail digitados no contrato prevalecem sobre os da identificação.
  v_nome := coalesce(nullif(btrim(left(coalesce(p->>'nome',''),120)),''), r.nome);
  v_email := coalesce(nullif(lower(btrim(left(coalesce(p->>'email',''),160))),''), r.email);
  IF length(v_nome) < 3 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido'; END IF;

  v_hash := public.fn_clube_hash_cpf(v_cpf);
  IF r.verificacao_id IS NOT NULL AND r.aluno_id IS NOT NULL THEN
    SELECT cpf_hash INTO v_cad_hash FROM public.alunos WHERE id = r.aluno_id;
    IF v_cad_hash IS NOT NULL AND v_cad_hash <> v_hash THEN RAISE EXCEPTION 'Este CPF não confere com o seu cadastro'; END IF;
  ELSE
    SELECT a.id INTO v_outro FROM public.alunos a
     WHERE a.cpf_hash = v_hash AND (r.aluno_id IS NULL OR a.id <> r.aluno_id OR a.status <> 'lead')
     ORDER BY (a.status <> 'lead') DESC LIMIT 1;
    IF v_outro IS NOT NULL THEN
      UPDATE public.propostas_planos_2027 SET aluno_suspeito_id = coalesce(aluno_suspeito_id, v_outro) WHERE id = r.id;
      RETURN jsonb_build_object('erro', 'Este CPF precisa ser confirmado. Volte e identifique-se como aluno');
    END IF;
  END IF;

  v_calc := public.fn_checkout_2027_calcular(p_proposta_id);
  v_t := public.fn_checkout_2027_template(p_proposta_id, v_calc->>'familia', r.forma_plano);
  SELECT to_jsonb(c) INTO v_item FROM public.planos_catalogo c WHERE c.id = (v_calc->>'catalogo_id')::uuid;
  SELECT versao INTO v_reg FROM public.regulamento_interno_versoes WHERE ativo ORDER BY versao DESC LIMIT 1;
  IF v_reg IS NULL THEN RAISE EXCEPTION 'Contrato indisponível no momento'; END IF;

  v_c := jsonb_build_object('nome', v_nome, 'email', v_email, 'data_nascimento', v_nasc,
    'cep', v_cep, 'logradouro', btrim(p->>'logradouro'), 'numero', btrim(p->>'numero'),
    'complemento', nullif(btrim(coalesce(p->>'complemento','')),''), 'bairro', btrim(p->>'bairro'),
    'cidade', btrim(p->>'cidade'), 'uf', upper(p->>'uf'), 'rg', nullif(btrim(coalesce(p->>'rg','')),''));
  UPDATE public.propostas_planos_2027
     SET contratante = v_c, cpf_hash = v_hash, cpf_ultimos3 = right(v_cpf,3),
         revisao = v_calc || jsonb_build_object('revisado_em', now()), etapa_atualizada_em = now()
   WHERE id = r.id;

  RETURN jsonb_build_object('template', jsonb_build_object('id', v_t.id, 'nome', v_t.nome, 'versao', v_t.versao, 'conteudo', v_t.conteudo),
    'regulamento_versao', v_reg, 'item', v_item, 'calculo', v_calc,
    'contratante', v_c || jsonb_build_object('cpf', v_cpf));
END $function$;

-- 4. Aceite com ANEXO I.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_aceitar(p_proposta_id uuid, p_chave text, p jsonb, p_ip text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_anexo jsonb; v_ass text; r public.propostas_planos_2027; v_calc jsonb; v_t public.contrato_templates; v_hash text; v_ac record; v_id uuid; v_reg int; v_vars jsonb;
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ck:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF NOT public.fn_planos_limite('ck:a:'||p_proposta_id::text, 20) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout IN ('aguardando_pagamento','paga') THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF r.contratante IS NULL OR r.cpf_hash IS NULL THEN RAISE EXCEPTION 'Preencha seus dados antes de aceitar'; END IF;
  IF coalesce((p->>'li_e_aceito')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Marque que você leu e aceita o contrato'; END IF;

  -- ANEXO I (opcional neste banco; a função do site exige). Assinatura fora do JSON e do hash.
  v_anexo := p->'anexo';
  IF v_anexo IS NOT NULL AND jsonb_typeof(v_anexo) = 'object' THEN
    IF coalesce(v_anexo->>'versao','') !~ '^anexo1-[a-z0-9.-]{1,30}$' THEN RAISE EXCEPTION 'Preencha o ANEXO I'; END IF;
    IF coalesce(v_anexo->>'medical_status','') NOT IN ('ok','restricao') THEN RAISE EXCEPTION 'Selecione a opção da Avaliação Médica'; END IF;
    IF jsonb_typeof(v_anexo->'image_usage') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Selecione a opção do Direito de Uso de Imagem'; END IF;
    IF coalesce((v_anexo->>'lgpd')::boolean,false) IS NOT TRUE OR coalesce((v_anexo->>'termos_lidos')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Leia e aceite os termos do ANEXO I'; END IF;
    IF length(btrim(coalesce(v_anexo->>'emergency_contact_name',''))) < 3 OR length(regexp_replace(coalesce(v_anexo->>'emergency_contact_phone',''),'\D','','g')) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Informe o contato de emergência'; END IF;
    v_ass := p->>'anexo_assinatura';
    IF v_ass IS NULL OR v_ass !~ '^data:image/png;base64,' OR length(v_ass) > 1000000 THEN RAISE EXCEPTION 'Assine o ANEXO I'; END IF;
    v_anexo := jsonb_build_object('versao', v_anexo->>'versao', 'medical_status', v_anexo->>'medical_status',
      'image_usage', (v_anexo->>'image_usage')::boolean, 'lgpd', true, 'termos_lidos', true,
      'emergency_contact_name', left(btrim(v_anexo->>'emergency_contact_name'),120),
      'emergency_contact_phone', left(regexp_replace(v_anexo->>'emergency_contact_phone','\D','','g'),13));
  ELSE
    v_anexo := NULL; v_ass := NULL;
  END IF;

  v_hash := public.fn_checkout_2027_hash(p->>'conteudo_html');
  IF coalesce(p->>'hash_exibido','') <> v_hash THEN RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;

  v_calc := public.fn_checkout_2027_calcular(p_proposta_id);
  v_t := public.fn_checkout_2027_template(p_proposta_id, v_calc->>'familia', r.forma_plano);
  IF (p->>'template_id')::uuid IS DISTINCT FROM v_t.id OR (p->>'template_versao')::int IS DISTINCT FROM v_t.versao THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo';
  END IF;
  SELECT versao INTO v_reg FROM public.regulamento_interno_versoes WHERE ativo ORDER BY versao DESC LIMIT 1;

  SELECT * INTO v_ac FROM public.propostas_2027_aceites WHERE proposta_id = r.id AND invalidado_em IS NULL;
  IF FOUND THEN
    IF v_ac.hash_texto = v_hash AND v_ac.valor_total_centavos = (v_calc->>'total_centavos')::bigint THEN
      RETURN jsonb_build_object('aceite_id', v_ac.id, 'etapa', 'contrato_aceito', 'aceito_em', v_ac.aceito_em);
    END IF;
    UPDATE public.propostas_2027_aceites SET invalidado_em = now(), motivo_invalidacao = 'novo aceite' WHERE id = v_ac.id;
  END IF;

  v_vars := coalesce(p->'variaveis','{}'::jsonb);
  IF v_vars ? 'CPF' THEN v_vars := v_vars || jsonb_build_object('CPF', '***.***.**' || r.cpf_ultimos3); END IF;

  INSERT INTO public.propostas_2027_aceites(proposta_id, template_id, template_versao, regulamento_versao, conteudo_html,
      variaveis, hash_texto, valor_total_centavos, ip, user_agent, anexo, anexo_versao, anexo_assinatura)
  VALUES (r.id, v_t.id, v_t.versao, v_reg, p->>'conteudo_html', v_vars, v_hash,
      (v_calc->>'total_centavos')::bigint, nullif(p_ip,''), left(p_user_agent, 500), v_anexo, v_anexo->>'versao', v_ass)
  RETURNING id INTO v_id;
  UPDATE public.propostas_planos_2027 SET aceite_id = v_id, etapa_checkout = 'contrato_aceito', etapa_atualizada_em = now(),
         revisao = v_calc || jsonb_build_object('revisado_em', now())
   WHERE id = r.id;
  RETURN jsonb_build_object('aceite_id', v_id, 'etapa', 'contrato_aceito', 'aceito_em', now());
END $function$;

-- 5. Grava o ANEXO I na ficha (mesma tabela do /assinar), uma linha por CPF.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_anexo_gravar(p_proposta_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE r public.propostas_planos_2027; ac public.propostas_2027_aceites; v_teste boolean; v_hash text; v_enc bytea; v_id uuid;
  v_c jsonb; v_criador uuid; v_notif uuid;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  IF NOT FOUND OR r.ativada_em IS NULL OR r.aluno_ativado_id IS NULL OR r.aceite_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO ac FROM public.propostas_2027_aceites WHERE id = r.aceite_id;
  IF NOT FOUND OR ac.anexo IS NULL THEN RETURN NULL; END IF;
  v_teste := r.teste_admin OR public.fn_checkout_2027_teste(r.id);
  v_c := coalesce(r.contratante, '{}'::jsonb);
  IF v_teste THEN
    -- Teste: só no NICOLAS TESTE, nunca no anexo do CPF real.
    v_hash := NULL; v_enc := NULL;
    SELECT id INTO v_id FROM public.legal_annexes WHERE aluno_id = r.aluno_ativado_id AND document_type = 'anexo' AND cpf_hash IS NULL ORDER BY signed_at DESC LIMIT 1;
  ELSE
    v_hash := r.cpf_hash;
    SELECT cpf_encrypted INTO v_enc FROM public.alunos WHERE id = r.aluno_ativado_id AND cpf_hash = r.cpf_hash;
    SELECT id INTO v_id FROM public.legal_annexes WHERE cpf_hash = v_hash AND document_type = 'anexo' ORDER BY signed_at DESC LIMIT 1;
  END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.legal_annexes SET nome = coalesce(v_c->>'nome', r.nome), data_nascimento = (v_c->>'data_nascimento')::date,
      telefone = r.whatsapp, email = coalesce(v_c->>'email', r.email),
      emergency_contact_name = ac.anexo->>'emergency_contact_name', emergency_contact_phone = ac.anexo->>'emergency_contact_phone',
      medical_status = ac.anexo->>'medical_status', image_usage = (ac.anexo->>'image_usage')::boolean,
      signature_data = ac.anexo_assinatura, attachment_url = NULL, ip_address = ac.ip, signed_at = ac.aceito_em,
      valid_until = ac.aceito_em + interval '1 year', aluno_id = r.aluno_ativado_id,
      cpf_hash = v_hash, cpf_encrypted = coalesce(v_enc, cpf_encrypted), cpf_ultimos3 = CASE WHEN v_teste THEN NULL ELSE r.cpf_ultimos3 END
     WHERE id = v_id;
  ELSE
    INSERT INTO public.legal_annexes (document_type, nome, data_nascimento, telefone, email, emergency_contact_name, emergency_contact_phone,
      medical_status, image_usage, signature_data, ip_address, signed_at, valid_until, aluno_id, cpf_hash, cpf_encrypted, cpf_ultimos3)
    VALUES ('anexo', coalesce(v_c->>'nome', r.nome), (v_c->>'data_nascimento')::date, r.whatsapp, coalesce(v_c->>'email', r.email),
      ac.anexo->>'emergency_contact_name', ac.anexo->>'emergency_contact_phone', ac.anexo->>'medical_status',
      (ac.anexo->>'image_usage')::boolean, ac.anexo_assinatura, ac.ip, ac.aceito_em, ac.aceito_em + interval '1 year',
      r.aluno_ativado_id, v_hash, v_enc, CASE WHEN v_teste THEN NULL ELSE r.cpf_ultimos3 END)
    RETURNING id INTO v_id;
  END IF;
  -- Restrição médica: aviso interno para a equipe buscar o atestado (uma vez por aceite).
  IF ac.anexo->>'medical_status' = 'restricao' AND NOT EXISTS (
       SELECT 1 FROM public.system_logs WHERE modulo = 'planos-anexo' AND acao = 'atestado_aviso' AND payload->>'aceite_id' = ac.id::text) THEN
    SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
    IF v_criador IS NOT NULL THEN
      INSERT INTO public.notificacoes (titulo, descricao, categoria, prioridade, tipo, criado_por)
      VALUES (CASE WHEN v_teste THEN '[TESTE] ' ELSE '' END || 'Atestado médico a receber: ' || coalesce(v_c->>'nome', r.nome, 'sem nome'),
        'Compra do site com "Com restrições" na Avaliação Médica (ANEXO I).' || E'\n'
        || 'Entre em contato para receber o atestado. WhatsApp ' || coalesce(r.whatsapp, '-'),
        'aluno', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
      INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
      SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
    END IF;
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
    VALUES ('planos-anexo', 'atestado_aviso', 'aviso de atestado criado', jsonb_build_object('aceite_id', ac.id, 'proposta_id', r.id, 'notificacao_id', v_notif));
  END IF;
  RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_anexo_gravar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_anexo_gravar(uuid) TO service_role;

-- 6. Disparo após a ativação; falha vira log e nunca desfaz pagamento nem ativação.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_anexo_trg()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  BEGIN
    PERFORM public.fn_checkout_2027_anexo_gravar(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
    VALUES ('planos-anexo', 'anexo_falhou', left(SQLERRM, 300), jsonb_build_object('proposta_id', NEW.id));
  END;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_checkout_2027_anexo ON public.propostas_planos_2027;
CREATE TRIGGER trg_checkout_2027_anexo AFTER UPDATE OF ativada_em ON public.propostas_planos_2027
  FOR EACH ROW WHEN (OLD.ativada_em IS NULL AND NEW.ativada_em IS NOT NULL) EXECUTE FUNCTION public.fn_checkout_2027_anexo_trg();