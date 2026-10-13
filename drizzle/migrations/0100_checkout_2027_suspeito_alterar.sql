-- 2C: a marcação de possível cadastro existente persiste (recusa devolvida como resultado, sem exceção),
-- e o botão Alterar troca as escolhas da mesma proposta, recalculando no servidor e invalidando o aceite.
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
      RETURN jsonb_build_object('erro', 'Este CPF precisa ser confirmado. Volte e identifique-se como aluno');
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

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_alterar(p_proposta_id uuid, p_chave text, p jsonb, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.propostas_planos_2027; v_calc jsonb; v_item record; v_serv text[];
BEGIN
  IF coalesce(p_ip,'') <> '' AND NOT public.fn_planos_limite('ck:i:'||p_ip, 60) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF NOT public.fn_planos_limite('ck:alt:'||p_proposta_id::text, 20) THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout IN ('aguardando_pagamento','paga') THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  SELECT * INTO v_item FROM public.planos_catalogo WHERE codigo = p->>'plano_codigo' AND versao IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível. Revise sua escolha'; END IF;
  v_serv := coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'servicos','[]'::jsonb))), '{}');
  UPDATE public.propostas_planos_2027 SET
    plano_codigo = v_item.codigo, familia = v_item.familia, frequencia = v_item.frequencia::text,
    forma_plano = coalesce(p->>'forma_plano', forma_plano),
    parcelas_plano = coalesce((p->>'parcelas_plano')::int, 1),
    servicos_codigos = v_serv,
    forma_servicos = CASE WHEN cardinality(v_serv) > 0 THEN p->>'forma_servicos' END,
    parcelas_servicos = CASE WHEN cardinality(v_serv) > 0 THEN coalesce((p->>'parcelas_servicos')::int, 1) END,
    corrida = coalesce((p->>'corrida')::boolean, false),
    configuracao = configuracao || jsonb_build_object('corrida_periodo_meses',
      CASE WHEN coalesce((p->>'corrida')::boolean, false) THEN coalesce((p->>'corrida_periodo_meses')::int, 1) END),
    updated_at = now()
  WHERE id = r.id;
  v_calc := public.fn_checkout_2027_calcular(p_proposta_id); -- valida; erro desfaz a troca
  UPDATE public.propostas_2027_aceites SET invalidado_em = now(), motivo_invalidacao = 'escolhas alteradas'
   WHERE proposta_id = r.id AND invalidado_em IS NULL;
  UPDATE public.propostas_planos_2027 SET aceite_id = NULL, etapa_checkout = 'identificada', etapa_atualizada_em = now(),
         valor_total_centavos = (v_calc->>'total_centavos')::bigint, revisao = v_calc || jsonb_build_object('revisado_em', now())
   WHERE id = r.id;
  RETURN v_calc || jsonb_build_object('etapa', 'identificada');
END $$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_alterar(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_alterar(uuid,text,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_contrato_gerar(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_contrato_gerar(uuid,text,jsonb,text) TO service_role;