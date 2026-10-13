-- Fase 2A: funções do checkout /planos 2027. Todas security definer, search_path fixo, EXECUTE só service_role.

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_hash(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(coalesce(p,''),'UTF8')),'hex')
$$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_teste(p_proposta_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.propostas_planos_2027 pr, public.sistema_config sc
     WHERE pr.id = p_proposta_id AND sc.chave = 'vendas_2027_teste_aluno_ids'
       AND pr.aluno_id IS NOT NULL AND sc.valor ? pr.aluno_id::text)
$$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_liberado(p_proposta_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT valor = 'true'::jsonb FROM public.sistema_config WHERE chave='planos_checkout_ativo'), false)
      OR public.fn_checkout_2027_teste(p_proposta_id)
$$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_sessao(p_proposta_id uuid, p_chave text)
RETURNS public.propostas_planos_2027 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND OR r.chave_sessao_hash IS NULL OR length(coalesce(p_chave,'')) < 32
     OR r.chave_sessao_hash <> public.fn_checkout_2027_hash(p_chave) THEN
    RAISE EXCEPTION 'Sessão inválida. Recomece a compra';
  END IF;
  IF NOT public.fn_checkout_2027_liberado(p_proposta_id) THEN
    RAISE EXCEPTION 'Checkout indisponível no momento';
  END IF;
  IF r.etapa_checkout = 'paga' THEN RETURN r; END IF;
  IF r.expira_em IS NOT NULL AND r.expira_em < now() THEN
    UPDATE public.propostas_planos_2027 SET etapa_checkout='expirada', etapa_atualizada_em=now() WHERE id=r.id;
  END IF;
  UPDATE public.propostas_planos_2027 SET expira_em = now() + interval '24 hours' WHERE id = r.id
    RETURNING * INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_iniciar(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_chave text; v_n int;
BEGIN
  IF NOT public.fn_checkout_2027_liberado(p_proposta_id) THEN RAISE EXCEPTION 'Checkout indisponível no momento'; END IF;
  v_chave := encode(extensions.gen_random_bytes(32),'hex');
  UPDATE public.propostas_planos_2027
     SET chave_sessao_hash = public.fn_checkout_2027_hash(v_chave), etapa_checkout='identificada',
         etapa_atualizada_em=now(), expira_em = now() + interval '24 hours'
   WHERE id = p_proposta_id AND chave_sessao_hash IS NULL AND created_at > now() - interval '2 hours';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'Sessão inválida. Recomece a compra'; END IF;
  RETURN jsonb_build_object('chave_sessao', v_chave, 'etapa', 'identificada');
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_calcular(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr public.propostas_planos_2027; v_item record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_livre boolean; v_serv_c bigint; v_serv_n int; v_plano_c bigint; v_parc int; v_corrida_c bigint; v_per int;
  v_servicos jsonb;
BEGIN
  SELECT * INTO pr FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  v_livre := pr.previa AND public.fn_checkout_2027_teste(p_proposta_id);
  SELECT * INTO v_item FROM public.planos_catalogo c
   WHERE c.codigo = pr.plano_codigo AND c.versao IS NOT NULL AND c.familia IN ('start_2027','power_2027','pro_2027')
     AND (v_livre OR (coalesce(c.ativo,false) AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= v_hoje)
          AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= v_hoje)));
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível. Revise sua escolha'; END IF;

  SELECT coalesce(sum(round(s.valor*100)),0)::bigint, count(*),
         coalesce(jsonb_agg(jsonb_build_object('codigo',s.codigo,'nome',s.nome,'valor_centavos',round(s.valor*100)::bigint)),'[]'::jsonb)
    INTO v_serv_c, v_serv_n, v_servicos
    FROM public.servicos_catalogo s
   WHERE s.codigo = ANY(pr.servicos_codigos) AND s.versao IS NOT NULL
     AND s.codigo IN ('nutri_4_comp_2_2027','nutri_8_2027','reab_4_2027','reab_8_2027')
     AND (v_livre OR (coalesce(s.ativo,false) AND (s.vendavel_desde IS NULL OR s.vendavel_desde <= v_hoje)
          AND (s.vendavel_ate IS NULL OR s.vendavel_ate >= v_hoje)));
  IF v_serv_n <> coalesce(array_length(pr.servicos_codigos,1),0) THEN RAISE EXCEPTION 'Acompanhamento indisponível. Revise sua escolha'; END IF;

  IF v_item.modalidade_cobranca = 'recorrencia_mensal' THEN
    IF pr.forma_plano <> 'recorrencia' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
    v_parc := CASE WHEN v_item.familia='start_2027' THEN 1 ELSE 12 END;
    v_plano_c := (round(v_item.valor*100) + CASE WHEN v_item.familia='start_2027' THEN 0
                  ELSE round(coalesce(v_item.taxa_recorrencia,0)*100) END)::bigint * v_parc;
  ELSE
    IF pr.forma_plano NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
    v_parc := CASE WHEN pr.forma_plano='pix_vista' THEN 1 ELSE pr.parcelas_plano END;
    IF v_parc < 1 OR v_parc > 12 THEN RAISE EXCEPTION 'Plano em até 12x'; END IF;
    v_plano_c := round(v_item.valor*100)::bigint;
  END IF;

  IF pr.corrida THEN
    v_per := coalesce((pr.configuracao->>'corrida_periodo_meses')::int, 1);
    SELECT round(p2.valor*100)::bigint INTO v_corrida_c FROM public.planos_catalogo p2
     WHERE p2.atividade='corrida' AND coalesce(p2.ativo,false) AND p2.versao IS NULL AND p2.periodo_meses = v_per
       AND p2.nome = 'Corrida - ' || CASE v_item.familia WHEN 'start_2027' THEN 'Start' WHEN 'power_2027' THEN 'Power' ELSE 'Pro' END
     LIMIT 1;
    IF v_corrida_c IS NULL THEN RAISE EXCEPTION 'Grupo de corrida indisponível'; END IF;
  END IF;

  RETURN jsonb_build_object(
    'catalogo_id', v_item.id, 'familia', v_item.familia, 'plano_codigo', v_item.codigo,
    'modalidade_cobranca', v_item.modalidade_cobranca, 'forma_plano', pr.forma_plano, 'parcelas_plano', v_parc,
    'plano_centavos', v_plano_c, 'servicos', v_servicos, 'servicos_centavos', v_serv_c,
    'forma_servicos', pr.forma_servicos, 'parcelas_servicos', pr.parcelas_servicos,
    'corrida_periodo_meses', CASE WHEN pr.corrida THEN v_per END, 'corrida_total_centavos', v_corrida_c,
    'total_centavos', v_plano_c + v_serv_c);
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_template(p_proposta_id uuid, p_familia text, p_forma_plano text)
RETURNS public.contrato_templates LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.contrato_templates; v_forma text;
BEGIN
  v_forma := CASE WHEN p_forma_plano = 'recorrencia' THEN 'cartao_recorrencia' ELSE 'cartao_parcelado' END;
  SELECT * INTO t FROM public.contrato_templates
   WHERE plano_tipo = p_familia AND forma_pagamento = v_forma AND p_familia IN ('start_2027','power_2027','pro_2027')
     AND (ativo OR public.fn_checkout_2027_teste(p_proposta_id))
   ORDER BY ativo DESC, versao DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato indisponível para esta escolha'; END IF;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_estado(p_proposta_id uuid, p_chave text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  RETURN jsonb_build_object('etapa', r.etapa_checkout, 'expira_em', r.expira_em, 'revisao', r.revisao,
    'contratante_ok', r.contratante IS NOT NULL AND r.cpf_hash IS NOT NULL,
    'cpf_final', CASE WHEN r.cpf_hash IS NOT NULL THEN r.cpf_ultimos3 END,
    'aceite_id', r.aceite_id, 'tipo_identificacao', r.tipo_identificacao);
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_revisar(p_proposta_id uuid, p_chave text, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027; v_calc jsonb; v_t public.contrato_templates; v_ac_id uuid; v_ac record;
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ck:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout IN ('aguardando_pagamento','paga') THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  v_calc := public.fn_checkout_2027_calcular(p_proposta_id);
  v_t := public.fn_checkout_2027_template(p_proposta_id, v_calc->>'familia', r.forma_plano);
  SELECT * INTO v_ac FROM public.propostas_2027_aceites WHERE proposta_id = r.id AND invalidado_em IS NULL;
  IF FOUND THEN
    IF v_ac.valor_total_centavos <> (v_calc->>'total_centavos')::bigint OR v_ac.template_id <> v_t.id OR v_ac.template_versao <> v_t.versao THEN
      UPDATE public.propostas_2027_aceites SET invalidado_em = now(), motivo_invalidacao = 'valor ou contrato alterado' WHERE id = v_ac.id;
      UPDATE public.propostas_planos_2027 SET aceite_id = NULL WHERE id = r.id;
    ELSE v_ac_id := v_ac.id; END IF;
  END IF;
  UPDATE public.propostas_planos_2027
     SET revisao = v_calc || jsonb_build_object('revisado_em', now()),
         etapa_checkout = CASE WHEN v_ac_id IS NOT NULL THEN 'contrato_aceito' ELSE 'identificada' END,
         etapa_atualizada_em = now()
   WHERE id = r.id;
  RETURN v_calc || jsonb_build_object('etapa', CASE WHEN v_ac_id IS NOT NULL THEN 'contrato_aceito' ELSE 'identificada' END);
END $$;

-- CPF guardado só como hash + 3 últimos dígitos; o CPF completo volta só para a função do servidor montar o texto.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_contrato_gerar(p_proposta_id uuid, p_chave text, p jsonb, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.propostas_planos_2027; v_calc jsonb; v_t public.contrato_templates; v_item jsonb;
  v_cpf text := regexp_replace(coalesce(p->>'cpf',''),'\D','','g'); v_hash text; v_outro uuid; v_cad_hash text;
  v_cep text := regexp_replace(coalesce(p->>'cep',''),'\D','','g'); v_nasc date; v_c jsonb; v_reg int;
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ck:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF NOT public.fn_planos_limite('ck:p:'||p_proposta_id::text, 20) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout IN ('aguardando_pagamento','paga') THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF NOT public.fn_cpf_digitos_validos(v_cpf) THEN RAISE EXCEPTION 'CPF inválido. Confira os números'; END IF;
  BEGIN v_nasc := (p->>'data_nascimento')::date; EXCEPTION WHEN OTHERS THEN v_nasc := NULL; END;
  IF v_nasc IS NULL OR v_nasc > current_date - interval '16 years' OR v_nasc < date '1900-01-01' THEN RAISE EXCEPTION 'Informe uma data de nascimento válida'; END IF;
  IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'Informe um CEP válido'; END IF;
  IF length(btrim(coalesce(p->>'logradouro',''))) < 3 OR length(btrim(coalesce(p->>'numero',''))) < 1
     OR length(btrim(coalesce(p->>'bairro',''))) < 2 OR length(btrim(coalesce(p->>'cidade',''))) < 2
     OR upper(coalesce(p->>'uf','')) !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Preencha o endereço completo'; END IF;

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
      RAISE EXCEPTION 'Este CPF precisa ser confirmado. Volte e identifique-se como aluno';
    END IF;
  END IF;

  v_calc := public.fn_checkout_2027_calcular(p_proposta_id);
  v_t := public.fn_checkout_2027_template(p_proposta_id, v_calc->>'familia', r.forma_plano);
  SELECT to_jsonb(c) INTO v_item FROM public.planos_catalogo c WHERE c.id = (v_calc->>'catalogo_id')::uuid;
  SELECT versao INTO v_reg FROM public.regulamento_interno_versoes WHERE ativo ORDER BY versao DESC LIMIT 1;
  IF v_reg IS NULL THEN RAISE EXCEPTION 'Contrato indisponível no momento'; END IF;

  v_c := jsonb_build_object('nome', r.nome, 'email', r.email, 'data_nascimento', v_nasc,
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
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_aceitar(p_proposta_id uuid, p_chave text, p jsonb, p_ip text, p_user_agent text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027; v_calc jsonb; v_t public.contrato_templates; v_hash text; v_ac record; v_id uuid; v_reg int; v_vars jsonb;
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ck:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF NOT public.fn_planos_limite('ck:a:'||p_proposta_id::text, 20) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout IN ('aguardando_pagamento','paga') THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF r.contratante IS NULL OR r.cpf_hash IS NULL THEN RAISE EXCEPTION 'Preencha seus dados antes de aceitar'; END IF;
  IF coalesce((p->>'li_e_aceito')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Marque que você leu e aceita o contrato'; END IF;

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
      variaveis, hash_texto, valor_total_centavos, ip, user_agent)
  VALUES (r.id, v_t.id, v_t.versao, v_reg, p->>'conteudo_html', v_vars, v_hash,
      (v_calc->>'total_centavos')::bigint, nullif(p_ip,''), left(p_user_agent, 500))
  RETURNING id INTO v_id;
  UPDATE public.propostas_planos_2027 SET aceite_id = v_id, etapa_checkout = 'contrato_aceito', etapa_atualizada_em = now(),
         revisao = v_calc || jsonb_build_object('revisado_em', now())
   WHERE id = r.id;
  RETURN jsonb_build_object('aceite_id', v_id, 'etapa', 'contrato_aceito', 'aceito_em', now());
END $$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_teste(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_liberado(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_sessao(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_iniciar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_calcular(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_template(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_estado(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_revisar(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_contrato_gerar(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_aceitar(uuid,text,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_hash(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_teste(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_liberado(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_sessao(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_iniciar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_calcular(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_template(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_estado(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_revisar(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_contrato_gerar(uuid,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_aceitar(uuid,text,jsonb,text,text) TO service_role;