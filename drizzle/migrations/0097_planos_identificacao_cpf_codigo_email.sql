
CREATE TABLE public.planos_verificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  email text NOT NULL,
  codigo_hash text NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  expira_em timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  validado_em timestamptz,
  consumido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.planos_verificacoes TO service_role;
ALTER TABLE public.planos_verificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le verificacoes" ON public.planos_verificacoes FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.planos_verificacoes TO authenticated;
CREATE INDEX ON public.planos_verificacoes(aluno_id, created_at DESC);

ALTER TABLE public.propostas_planos_2027
  ADD COLUMN IF NOT EXISTS aluno_suspeito_id uuid,
  ADD COLUMN IF NOT EXISTS verificacao_id uuid;

INSERT INTO public.sistema_config(chave, valor) VALUES
  ('planos_turnstile_ativo', 'false'::jsonb),
  ('planos_codigo_email_teste_ids', '["085acf57-2dbe-464d-9acc-e1b0f5b77032"]'::jsonb),
  ('planos_codigo_email_livre', 'false'::jsonb)
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_cpf_digitos_validos(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE d text := regexp_replace(coalesce(p,''),'\D','','g'); s int; r int; i int;
BEGIN
  IF length(d)<>11 OR d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s:=0; FOR i IN 1..9 LOOP s:=s+substr(d,i,1)::int*(11-i); END LOOP;
  r:=(s*10)%11; IF r=10 THEN r:=0; END IF; IF r<>substr(d,10,1)::int THEN RETURN false; END IF;
  s:=0; FOR i IN 1..10 LOOP s:=s+substr(d,i,1)::int*(12-i); END LOOP;
  r:=(s*10)%11; IF r=10 THEN r:=0; END IF; RETURN r=substr(d,11,1)::int;
END $$;

-- Limite horário genérico (só service_role e funções internas).
CREATE OR REPLACE FUNCTION public.fn_planos_limite(p_chave text, p_limite int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n int;
BEGIN
  INSERT INTO public.rate_limit_propostas_planos(chave,janela,contagem) VALUES (p_chave,date_trunc('hour',now()),1)
  ON CONFLICT(chave,janela) DO UPDATE SET contagem=rate_limit_propostas_planos.contagem+1 RETURNING contagem INTO v_n;
  RETURN v_n<=p_limite;
END $$;

-- Resolve o cadastro único por telefone ou CPF (hash). Nunca exposto ao público.
CREATE OR REPLACE FUNCTION public.fn_planos_resolver(p_tipo text, p_valor text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n int; v_id uuid; v_tel text;
BEGIN
  IF p_tipo='cpf' THEN
    IF NOT public.fn_cpf_digitos_validos(p_valor) THEN RETURN NULL; END IF;
    SELECT count(*),(array_agg(id))[1] INTO v_n,v_id FROM public.alunos WHERE cpf_hash=public.fn_clube_hash_cpf(p_valor);
  ELSIF p_tipo='telefone' THEN
    v_tel:=public.fn_planos_normalizar_telefone(p_valor);
    IF v_tel IS NULL THEN RETURN NULL; END IF;
    SELECT count(*),(array_agg(id))[1] INTO v_n,v_id FROM public.alunos WHERE public.fn_planos_normalizar_telefone(telefone)=v_tel;
  ELSE RETURN NULL; END IF;
  RETURN CASE WHEN v_n=1 THEN v_id END;
END $$;

CREATE OR REPLACE FUNCTION public.fn_planos_identificar(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tipo text := p->>'tipo'; v_valor text := coalesce(p->>'valor',''); v_ip text; v_chave text; v_id uuid; v_nome text; v_mask text;
BEGIN
  IF v_tipo NOT IN ('telefone','cpf') THEN RETURN jsonb_build_object('existe',false); END IF;
  v_ip:=coalesce(nullif(split_part(coalesce(nullif(current_setting('request.headers',true),'')::json->>'x-forwarded-for',''),',',1),''),'sem-ip');
  IF NOT public.fn_planos_limite('ident-ip:'||v_ip,30) THEN RETURN jsonb_build_object('existe',false,'limitado',true); END IF;
  v_chave := CASE WHEN v_tipo='cpf' THEN 'ident-cpf:'||left(public.fn_clube_hash_cpf(v_valor),24)
                  ELSE 'ident-tel:'||coalesce(public.fn_planos_normalizar_telefone(v_valor),'invalido') END;
  IF NOT public.fn_planos_limite(v_chave,10) THEN RETURN jsonb_build_object('existe',false,'limitado',true); END IF;
  v_id := public.fn_planos_resolver(v_tipo, v_valor);
  IF v_id IS NULL THEN RETURN jsonb_build_object('existe',false); END IF;
  SELECT nome INTO v_nome FROM public.alunos WHERE id=v_id;
  SELECT string_agg(upper(left(part,1))||'.',' ' ORDER BY ord) INTO v_mask
    FROM unnest(regexp_split_to_array(btrim(v_nome),'\s+')) WITH ORDINALITY AS a(part,ord) WHERE part<>'';
  RETURN jsonb_build_object('existe',true,'nome_mascarado',v_mask);
END $$;

CREATE OR REPLACE FUNCTION public.fn_planos_codigo_validar(p_id uuid, p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.planos_verificacoes;
BEGIN
  SELECT * INTO r FROM public.planos_verificacoes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'motivo','invalido'); END IF;
  IF r.validado_em IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'motivo','usado'); END IF;
  IF r.tentativas>=5 THEN RETURN jsonb_build_object('ok',false,'motivo','bloqueado'); END IF;
  IF r.expira_em<now() THEN RETURN jsonb_build_object('ok',false,'motivo','expirado'); END IF;
  IF r.codigo_hash<>p_hash THEN
    UPDATE public.planos_verificacoes SET tentativas=tentativas+1 WHERE id=p_id;
    RETURN jsonb_build_object('ok',false,'motivo', CASE WHEN r.tentativas+1>=5 THEN 'bloqueado' ELSE 'errado' END,'restantes',greatest(0,4-r.tentativas));
  END IF;
  UPDATE public.planos_verificacoes SET validado_em=now(), tentativas=tentativas+1 WHERE id=p_id;
  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE ALL ON FUNCTION public.fn_planos_limite(text,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_planos_resolver(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_planos_codigo_validar(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_planos_limite(text,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_planos_resolver(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_planos_codigo_validar(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_planos_identificar(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_cpf_digitos_validos(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_proposta_plano_2027_criar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_previa boolean := coalesce((p->>'previa')::boolean, false);
  v_tipo text := coalesce(p->>'tipo_identificacao', 'novo');
  v_vinculado uuid;
  v_real text;
  v_match int;
  v_cpf_final text;
  v_nome text := btrim(coalesce(p->>'nome', ''));
  v_wpp text := regexp_replace(coalesce(p->>'whatsapp', ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p->>'email', '')));
  v_cpf text := regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g');
  v_codigo text := p->>'plano_codigo';
  v_forma text := p->>'forma_plano';
  v_parc int := coalesce((p->>'parcelas_plano')::int, 1);
  v_serv text[] := coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'servicos', '[]'::jsonb))), '{}');
  v_forma_s text := p->>'forma_servicos';
  v_parc_s int := coalesce((p->>'parcelas_servicos')::int, 1);
  v_corrida boolean := coalesce((p->>'corrida')::boolean, false);
  v_item record;
  v_serv_c bigint := 0;
  v_serv_n int := 0;
  v_plano_c bigint;
  v_total_c bigint;
  v_corrida_valor numeric;
  v_corrida_periodo int := coalesce((p->>'corrida_periodo_meses')::int, 1);
  v_corrida_total numeric;
  v_ip text;
  v_janela timestamptz := date_trunc('hour', now());
  v_cont int;
  v_id uuid;
  v_aluno uuid;
  v_novo boolean := false;
  v_lead_erro text;
  v_criador uuid;
  v_notif uuid;
  v_ver_id uuid;
  v_tel_cad text;
  v_cpf_hash text;
  v_cand uuid;
  v_todos_lead boolean;
  v_suspeito uuid;
BEGIN
  IF v_previa AND NOT (auth.uid() IS NOT NULL AND public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Prévia disponível só para administradores';
  END IF;
  IF v_tipo NOT IN ('novo','aluno','ex_aluno') THEN RAISE EXCEPTION 'Identificação inválida'; END IF;
  -- Vínculo com cadastro só com código de e-mail validado (planos_verificacoes).
  IF v_tipo <> 'novo' AND coalesce((p->>'confirmar_vinculo')::boolean,false) THEN
    IF coalesce(p->>'verificacao_id','') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Confirme o código enviado ao seu e-mail'; END IF;
    UPDATE public.planos_verificacoes SET consumido_em=now()
     WHERE id=(p->>'verificacao_id')::uuid AND validado_em IS NOT NULL AND consumido_em IS NULL AND validado_em > now() - interval '30 minutes'
     RETURNING id, aluno_id INTO v_ver_id, v_vinculado;
    IF v_ver_id IS NULL THEN RAISE EXCEPTION 'Confirme o código enviado ao seu e-mail'; END IF;
    SELECT nome,coalesce(nullif(lower(btrim(email)),''),v_email),cpf_ultimos3,regexp_replace(coalesce(telefone,''),'\D','','g')
      INTO v_nome,v_email,v_cpf_final,v_tel_cad FROM public.alunos WHERE id=v_vinculado;
    IF length(v_tel_cad) IN (12,13) AND left(v_tel_cad,2)='55' THEN v_tel_cad:=substr(v_tel_cad,3); END IF;
    IF length(v_tel_cad) IN (10,11) THEN v_wpp := v_tel_cad; END IF;
    v_cpf := '';
    v_real := CASE WHEN EXISTS(SELECT 1 FROM public.planos WHERE aluno_id=v_vinculado AND ativo) THEN 'aluno' ELSE 'ex_aluno' END;
  END IF;
  v_wpp := regexp_replace(v_wpp,'\D','','g');
  IF length(v_wpp) IN (12,13) AND left(v_wpp,2)='55' THEN v_wpp:=substr(v_wpp,3); END IF;
  IF length(v_nome) < 3 OR length(v_nome) > 120 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_wpp) NOT IN (10, 11) THEN RAISE EXCEPTION 'Informe um WhatsApp válido com DDD'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN RAISE EXCEPTION 'Informe um e-mail válido'; END IF;
  IF v_cpf <> '' AND NOT public.fn_cpf_digitos_validos(v_cpf) THEN RAISE EXCEPTION 'CPF inválido. Confira os números'; END IF;

  -- Limite: 5 propostas por hora por WhatsApp e 20 por IP.
  v_ip := coalesce(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
  INSERT INTO public.rate_limit_propostas_planos(chave, janela, contagem) VALUES ('w:' || v_wpp, v_janela, 1)
    ON CONFLICT (chave, janela) DO UPDATE SET contagem = rate_limit_propostas_planos.contagem + 1
    RETURNING contagem INTO v_cont;
  IF v_cont > 5 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  IF v_ip <> '' THEN
    INSERT INTO public.rate_limit_propostas_planos(chave, janela, contagem) VALUES ('i:' || v_ip, v_janela, 1)
      ON CONFLICT (chave, janela) DO UPDATE SET contagem = rate_limit_propostas_planos.contagem + 1
      RETURNING contagem INTO v_cont;
    IF v_cont > 20 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  END IF;

  SELECT * INTO v_item FROM public.planos_catalogo c
  WHERE c.codigo = v_codigo AND c.versao IS NOT NULL AND c.familia IN ('start_2027', 'power_2027', 'pro_2027')
    AND (v_previa OR (coalesce(c.ativo, false)
         AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= v_hoje)
         AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= v_hoje)));
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano indisponível. Revise sua escolha'; END IF;

  SELECT coalesce(sum(round(s.valor * 100)), 0)::bigint, count(*) INTO v_serv_c, v_serv_n
  FROM public.servicos_catalogo s
  WHERE s.codigo = ANY(v_serv) AND s.versao IS NOT NULL
    AND s.codigo IN ('nutri_4_comp_2_2027', 'nutri_8_2027', 'reab_4_2027', 'reab_8_2027')
    AND (v_previa OR (coalesce(s.ativo, false)
         AND (s.vendavel_desde IS NULL OR s.vendavel_desde <= v_hoje)
         AND (s.vendavel_ate IS NULL OR s.vendavel_ate >= v_hoje)));
  IF v_serv_n <> coalesce(array_length(v_serv, 1), 0) THEN RAISE EXCEPTION 'Acompanhamento indisponível. Revise sua escolha'; END IF;

  IF v_item.modalidade_cobranca = 'recorrencia_mensal' THEN
    IF v_forma <> 'recorrencia' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
    v_parc := CASE WHEN v_item.familia = 'start_2027' THEN 1 ELSE 12 END;
    v_plano_c := (round(v_item.valor * 100) + CASE WHEN v_item.familia = 'start_2027' THEN 0
                  ELSE round(coalesce(v_item.taxa_recorrencia, 0) * 100) END)::bigint * v_parc;
    IF v_serv_n > 0 THEN
      IF v_forma_s NOT IN ('cartao_parcelado', 'pix_vista') THEN RAISE EXCEPTION 'Forma dos serviços inválida'; END IF;
      IF v_forma_s = 'pix_vista' THEN v_parc_s := 1; END IF;
      IF v_parc_s < 1 OR v_parc_s > 6 THEN RAISE EXCEPTION 'Serviços em até 6x'; END IF;
    ELSE v_forma_s := NULL; v_parc_s := NULL; END IF;
  ELSE
    IF v_forma NOT IN ('cartao_parcelado', 'pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
    IF v_forma = 'pix_vista' THEN v_parc := 1; END IF;
    IF v_parc < 1 OR v_parc > 12 THEN RAISE EXCEPTION 'Plano em até 12x'; END IF;
    v_plano_c := round(v_item.valor * 100)::bigint;
    IF v_forma = 'pix_vista' AND v_serv_n > 0 THEN
      IF v_forma_s NOT IN ('cartao_parcelado', 'pix_vista') THEN RAISE EXCEPTION 'Forma dos serviços inválida'; END IF;
      IF v_forma_s = 'pix_vista' THEN v_parc_s := 1; END IF;
      IF v_parc_s < 1 OR v_parc_s > 6 THEN RAISE EXCEPTION 'Serviços em até 6x'; END IF;
    ELSE v_forma_s := NULL; v_parc_s := NULL; END IF;
  END IF;
  v_total_c := v_plano_c + v_serv_c;

  IF v_corrida THEN
    IF v_corrida_periodo NOT IN (1, 6, 12) THEN RAISE EXCEPTION 'Período da corrida inválido'; END IF;
    SELECT p2.valor, p2.valor / p2.periodo_meses INTO v_corrida_total, v_corrida_valor FROM public.planos_catalogo p2
    WHERE p2.atividade = 'corrida' AND coalesce(p2.ativo, false) AND p2.versao IS NULL AND p2.periodo_meses = v_corrida_periodo
      AND p2.nome = 'Corrida - ' || CASE v_item.familia WHEN 'start_2027' THEN 'Start' WHEN 'power_2027' THEN 'Power' ELSE 'Pro' END
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Grupo de corrida indisponível'; END IF;
  END IF;

  INSERT INTO public.propostas_planos_2027(nome, whatsapp, email, cpf_ultimos3, plano_codigo, familia, frequencia,
    forma_plano, parcelas_plano, servicos_codigos, forma_servicos, parcelas_servicos, corrida, corrida_valor_mensal,
    valor_total_centavos, configuracao, previa)
  VALUES (v_nome, v_wpp, v_email, CASE WHEN v_cpf <> '' THEN right(v_cpf, 3) END, v_item.codigo, v_item.familia,
    v_item.frequencia::text, v_forma, v_parc, v_serv, v_forma_s, v_parc_s, v_corrida, v_corrida_valor, v_total_c,
    jsonb_build_object('plano_centavos', v_plano_c, 'servicos_centavos', v_serv_c, 'nome_plano',
      coalesce(v_item.nome_exibicao, v_item.nome), 'modalidade', v_item.modalidade_cobranca, 'corrida_periodo_meses', CASE WHEN v_corrida THEN v_corrida_periodo END, 'corrida_total_centavos', CASE WHEN v_corrida THEN round(v_corrida_total * 100) END), v_previa)
  RETURNING id INTO v_id;

  UPDATE public.propostas_planos_2027 SET tipo_identificacao=v_tipo, aluno_id=v_vinculado, vinculo_por_telefone=false,
    verificacao_vinculo=CASE WHEN v_ver_id IS NOT NULL THEN 'verificado_email' ELSE 'nao_verificado' END,
    verificacao_id=v_ver_id, status_real=v_real, cpf_ultimos3=coalesce(v_cpf_final,cpf_ultimos3) WHERE id=v_id;

  IF NOT v_previa THEN
    BEGIN
      v_aluno := v_vinculado;
      IF v_aluno IS NULL THEN
        -- Sem vínculo verificado: liga a lead existente ou marca possível duplicidade, sem criar cadastro repetido.
        v_cpf_hash := CASE WHEN v_cpf <> '' THEN public.fn_clube_hash_cpf(v_cpf) END;
        SELECT count(*), (array_agg(a.id))[1], bool_and(a.status='lead') INTO v_match, v_cand, v_todos_lead
          FROM public.alunos a
         WHERE public.fn_planos_normalizar_telefone(a.telefone)=public.fn_planos_normalizar_telefone(v_wpp)
            OR (v_cpf_hash IS NOT NULL AND a.cpf_hash=v_cpf_hash)
            OR lower(btrim(a.email))=v_email;
        IF v_match=1 AND v_todos_lead THEN
          v_aluno := v_cand;
        ELSIF v_match>=1 THEN
          SELECT a.id INTO v_suspeito FROM public.alunos a
           WHERE (public.fn_planos_normalizar_telefone(a.telefone)=public.fn_planos_normalizar_telefone(v_wpp)
              OR (v_cpf_hash IS NOT NULL AND a.cpf_hash=v_cpf_hash)
              OR lower(btrim(a.email))=v_email)
           ORDER BY (a.status<>'lead') DESC, (v_cpf_hash IS NOT NULL AND a.cpf_hash=v_cpf_hash) DESC, a.created_at
           LIMIT 1;
          UPDATE public.propostas_planos_2027 SET aluno_suspeito_id=v_suspeito WHERE id=v_id;
        END IF;
      END IF;
      IF v_aluno IS NULL AND v_suspeito IS NULL THEN
        INSERT INTO public.alunos(nome, telefone, email, status) VALUES (v_nome, v_wpp, v_email, 'lead')
        RETURNING id INTO v_aluno;
        v_novo := true;
        IF v_cpf <> '' THEN PERFORM public.fn_service_set_cpf(v_aluno, v_cpf); END IF;
        INSERT INTO public.pipeline_metadata(aluno_id, origem_lead) VALUES (v_aluno, 'Site /planos')
          ON CONFLICT (aluno_id) DO NOTHING;
        PERFORM public.fn_move_pipeline(v_aluno, 'Novo lead', 'manual'::pipeline_movement_source, 'Proposta do site /planos', NULL);
      END IF;
      IF v_aluno IS NOT NULL THEN
        INSERT INTO public.pipeline_metadata(aluno_id) VALUES (v_aluno) ON CONFLICT (aluno_id) DO NOTHING;
        UPDATE public.pipeline_metadata SET plano_interesse = coalesce(v_item.nome_exibicao, v_item.nome) || ' ' || v_item.frequencia::text,
          valor_estimado_plano = v_total_c / 100.0,
          notas = trim(both E'\n' from coalesce(notas, '') || E'\nProposta do site /planos em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
        WHERE aluno_id = v_aluno;
        UPDATE public.propostas_planos_2027 SET aluno_id = v_aluno WHERE id = v_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_lead_erro := SQLERRM;
      UPDATE public.propostas_planos_2027 SET lead_erro = v_lead_erro WHERE id = v_id;
    END;

    BEGIN
      SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
      IF v_criador IS NOT NULL THEN
        INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por, aluno_id)
        VALUES ('Nova proposta do site: ' || v_nome,
          coalesce(v_item.nome_exibicao, v_item.nome) || ' ' || v_item.frequencia::text || ' · total R$ ' ||
          to_char(v_total_c / 100.0, 'FM999G999D00') || ' · Tipo informado: ' || v_tipo ||
          CASE WHEN v_ver_id IS NOT NULL THEN ' · vínculo verificado por e-mail' ELSE ' · vínculo não verificado' END ||
          CASE WHEN v_suspeito IS NOT NULL THEN ' · possível cadastro existente, confira antes de criar outro' ELSE '' END ||
          ' · WhatsApp ' || v_wpp || '. Veja em Leads > Propostas do site.',
          'comercial', 'alta', 'simples', v_criador, coalesce(v_aluno, v_suspeito))
        RETURNING id INTO v_notif;
        INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
        SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.propostas_planos_2027 SET lead_erro = coalesce(lead_erro || ' | ', '') || 'notificação: ' || SQLERRM WHERE id = v_id;
    END;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'valor_total_centavos', v_total_c, 'previa', v_previa);
END;
$function$;
