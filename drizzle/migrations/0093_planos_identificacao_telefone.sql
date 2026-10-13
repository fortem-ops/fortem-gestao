ALTER TABLE public.propostas_planos_2027 ADD COLUMN tipo_identificacao text NOT NULL DEFAULT 'novo' CHECK (tipo_identificacao IN ('novo','aluno','ex_aluno')), ADD COLUMN vinculo_por_telefone boolean NOT NULL DEFAULT false, ADD COLUMN verificacao_vinculo text NOT NULL DEFAULT 'nao_verificado', ADD COLUMN status_real text;
CREATE OR REPLACE FUNCTION public.fn_planos_normalizar_telefone(t text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE d text := regexp_replace(coalesce(t,''),'\D','','g'); BEGIN IF length(d) IN (12,13) AND left(d,2)='55' THEN d:=substr(d,3); END IF; IF length(d)=11 AND substr(d,3,1)='9' THEN d:=left(d,2)||substr(d,4); END IF; IF length(d)<>10 THEN RETURN NULL; END IF; RETURN d; END $$;
REVOKE ALL ON FUNCTION public.fn_planos_normalizar_telefone(text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.fn_planos_identificar_telefone(p_telefone text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tel text:=public.fn_planos_normalizar_telefone(p_telefone); v_ip text; v_n int; v_nome text; v_count int; v_mask text;
BEGIN
v_ip:=coalesce(nullif(split_part(coalesce(nullif(current_setting('request.headers',true),'')::json->>'x-forwarded-for',''),',',1),''),'sem-ip');
INSERT INTO public.rate_limit_propostas_planos(chave,janela,contagem) VALUES ('ident-ip:'||v_ip,date_trunc('hour',now()),1) ON CONFLICT(chave,janela) DO UPDATE SET contagem=rate_limit_propostas_planos.contagem+1 RETURNING contagem INTO v_n;
IF v_n>30 THEN RETURN jsonb_build_object('existe',false,'limitado',true); END IF;
INSERT INTO public.rate_limit_propostas_planos(chave,janela,contagem) VALUES ('ident-tel:'||coalesce(v_tel,'invalido'),date_trunc('hour',now()),1) ON CONFLICT(chave,janela) DO UPDATE SET contagem=rate_limit_propostas_planos.contagem+1 RETURNING contagem INTO v_n;
IF v_n>10 THEN RETURN jsonb_build_object('existe',false,'limitado',true); END IF;
SELECT count(*),min(nome) INTO v_count,v_nome FROM public.alunos WHERE v_tel IS NOT NULL AND public.fn_planos_normalizar_telefone(telefone)=v_tel;
IF v_count<>1 THEN RETURN jsonb_build_object('existe',false); END IF;
SELECT string_agg(left(part,1)||'****',' ' ORDER BY ord) INTO v_mask FROM unnest(regexp_split_to_array(btrim(v_nome),'\s+')) WITH ORDINALITY AS a(part,ord);
RETURN jsonb_build_object('existe',true,'nome_mascarado',v_mask);
END $$;
REVOKE ALL ON FUNCTION public.fn_planos_identificar_telefone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_planos_identificar_telefone(text) TO anon,authenticated,service_role;
DO $migration$
DECLARE v text;
BEGIN
v:=pg_get_functiondef('public.fn_proposta_plano_2027_criar(jsonb)'::regprocedure);
IF position('  v_nome text' in v)=0 OR position('  IF NOT v_previa THEN' in v)=0 THEN RAISE EXCEPTION 'Unexpected proposal definition'; END IF;
v:=replace(v,'  v_nome text',E'  v_tipo text := coalesce(p->>''tipo_identificacao'', ''novo'');\n  v_vinculado uuid;\n  v_real text;\n  v_match int;\n  v_cpf_final text;\n  v_busca jsonb;\n  v_nome text');
v:=replace(v,'  IF length(v_nome) < 3',E'  IF v_tipo NOT IN (''novo'',''aluno'',''ex_aluno'') THEN RAISE EXCEPTION ''Identificação inválida''; END IF;\n  IF v_tipo <> ''novo'' AND coalesce((p->>''confirmar_vinculo'')::boolean,false) THEN\n    v_busca := public.fn_planos_identificar_telefone(v_wpp);\n    IF coalesce((v_busca->>''limitado'')::boolean,false) THEN RETURN jsonb_build_object(''limitado'',true); END IF;\n    SELECT count(*) INTO v_match FROM public.alunos WHERE public.fn_planos_normalizar_telefone(telefone)=public.fn_planos_normalizar_telefone(v_wpp);\n    IF v_match <> 1 THEN RAISE EXCEPTION ''Não encontramos o seu cadastro, preencha seus dados''; END IF;\n    SELECT id,nome,coalesce(nullif(btrim(email),''''),v_email),cpf_ultimos3 INTO v_vinculado,v_nome,v_email,v_cpf_final FROM public.alunos WHERE public.fn_planos_normalizar_telefone(telefone)=public.fn_planos_normalizar_telefone(v_wpp);\n    v_cpf := '''';\n    v_real := CASE WHEN EXISTS(SELECT 1 FROM public.planos WHERE aluno_id=v_vinculado AND ativo) THEN ''aluno'' ELSE ''ex_aluno'' END;\n  END IF;\n  v_wpp := regexp_replace(v_wpp,''\\D'','''',''g'');\n  IF length(v_wpp) IN (12,13) AND left(v_wpp,2)=''55'' THEN v_wpp:=substr(v_wpp,3); END IF;\n  IF length(v_nome) < 3');
v:=replace(v,'  IF NOT v_previa THEN',E'  UPDATE public.propostas_planos_2027 SET tipo_identificacao=v_tipo, aluno_id=v_vinculado, vinculo_por_telefone=(v_vinculado IS NOT NULL), verificacao_vinculo=''nao_verificado'', status_real=v_real, cpf_ultimos3=coalesce(v_cpf_final,cpf_ultimos3) WHERE id=v_id;\n\n  IF NOT v_previa THEN');
v:=replace(v,E'      SELECT a.id INTO v_aluno FROM public.alunos a\n      WHERE regexp_replace(coalesce(a.telefone, ''''), ''\D'', '''', ''g'') = v_wpp\n         OR (a.email IS NOT NULL AND lower(a.email) = v_email)\n      ORDER BY a.created_at LIMIT 1;',E'      v_aluno := v_vinculado;\n      IF v_aluno IS NULL THEN\n        SELECT count(*), (array_agg(a.id))[1] INTO v_match,v_aluno FROM public.alunos a WHERE public.fn_planos_normalizar_telefone(a.telefone)=public.fn_planos_normalizar_telefone(v_wpp);\n        IF v_match<>1 THEN v_aluno:=NULL; END IF;\n      END IF;');
v:=replace(v,''' · WhatsApp '' || v_wpp', ''' · Tipo informado: '' || v_tipo || '' · vínculo não verificado · WhatsApp '' || v_wpp');
EXECUTE v;
END $migration$;