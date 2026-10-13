CREATE OR REPLACE FUNCTION public.fn_checkout_2027_dados_contratante(p_proposta_id uuid, p_chave text, p_ip text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.propostas_planos_2027; a public.alunos; v_ok boolean;
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ckd:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF NOT public.fn_planos_limite('ckd:p:'||p_proposta_id::text, 20) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  -- Vínculo confirmado: proposta ligada ao aluno por código de e-mail validado para esse mesmo aluno.
  SELECT EXISTS (SELECT 1 FROM public.planos_verificacoes v
                  WHERE v.id = r.verificacao_id AND v.aluno_id = r.aluno_id AND v.validado_em IS NOT NULL)
    INTO v_ok;
  IF r.aluno_id IS NULL OR NOT coalesce(v_ok,false) THEN
    RETURN jsonb_build_object('confirmado', false, 'nome', r.nome, 'email', r.email);
  END IF;
  SELECT * INTO a FROM public.alunos WHERE id = r.aluno_id;
  RETURN jsonb_build_object('confirmado', true,
    'nome', coalesce(nullif(btrim(a.nome),''), r.nome), 'email', coalesce(nullif(btrim(a.email),''), r.email),
    'data_nascimento', a.data_nascimento, 'cep', a.cep, 'logradouro', a.logradouro, 'numero', a.numero,
    'complemento', a.complemento, 'bairro', a.bairro, 'cidade', a.cidade, 'uf', a.uf, 'rg', a.rg,
    'cpf_ultimos3', a.cpf_ultimos3);
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_dados_contratante(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_dados_contratante(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_contrato_gerar(p_proposta_id uuid, p_chave text, p jsonb, p_ip text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  IF v_nasc IS NULL OR v_nasc > current_date - interval '16 years' OR v_nasc < date '1900-01-01' THEN RAISE EXCEPTION 'Informe uma data de nascimento válida'; END IF;
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