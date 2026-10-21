CREATE OR REPLACE FUNCTION public.is_coordenador_ou_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','coordenador')) AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND ativo=false);
$$;
REVOKE ALL ON FUNCTION public.is_coordenador_ou_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coordenador_ou_admin() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.fn_user_roles_protege_ultimo_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.role='admin' THEN
  PERFORM pg_advisory_xact_lock(hashtext('fortem_ultimo_admin'));
  IF NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.role='admin' AND r.id<>OLD.id AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=r.user_id AND p.ativo=false)) THEN
   RAISE EXCEPTION 'Não é possível remover a última permissão de Administrador do sistema';
  END IF;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.fn_user_roles_protege_ultimo_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_user_roles_protege_ultimo_admin() TO service_role;
ALTER TABLE public.facial_consentimentos DROP CONSTRAINT facial_consentimentos_origem_check;
ALTER TABLE public.facial_consentimentos ADD CONSTRAINT facial_consentimentos_origem_check CHECK (origem IN ('app_aluno','perfil_equipe','link_responsavel'));
ALTER TABLE public.facial_consentimentos ADD COLUMN responsavel_parentesco text, ADD COLUMN responsavel_cpf_ultimos3 text, ADD COLUMN responsavel_cpf_hash text;
CREATE TABLE public.facial_links_responsavel (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, criado_por uuid NOT NULL, criado_em timestamptz DEFAULT now(),
 expira_em timestamptz NOT NULL DEFAULT now()+interval '7 days', usado_em timestamptz, revogado_em timestamptz,
 consentimento_id uuid REFERENCES public.facial_consentimentos(id)
);
GRANT SELECT ON public.facial_links_responsavel TO authenticated;
GRANT ALL ON public.facial_links_responsavel TO service_role;
ALTER TABLE public.facial_links_responsavel ENABLE ROW LEVEL SECURITY;
CREATE POLICY facial_links_leitura_equipe ON public.facial_links_responsavel FOR SELECT TO authenticated USING (public.is_staff());
CREATE INDEX facial_links_aluno_criado ON public.facial_links_responsavel(aluno_id,criado_em DESC);
CREATE OR REPLACE FUNCTION public.fn_facial_link_criar(p_aluno_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_token text; v_exp timestamptz:=now()+interval '7 days';
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito à equipe'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('facial_link:'||p_aluno_id::text));
 IF NOT EXISTS(SELECT 1 FROM public.alunos WHERE id=p_aluno_id AND (data_nascimento IS NULL OR data_nascimento>(current_date-interval '18 years')::date)) THEN RAISE EXCEPTION 'Cadastro não elegível para autorização do responsável'; END IF;
 UPDATE public.facial_links_responsavel SET revogado_em=now() WHERE aluno_id=p_aluno_id AND usado_em IS NULL AND revogado_em IS NULL;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.facial_links_responsavel(aluno_id,token_hash,criado_por,expira_em) VALUES(p_aluno_id,encode(extensions.digest(v_token,'sha256'),'hex'),auth.uid(),v_exp);
 RETURN jsonb_build_object('token',v_token,'expira_em',v_exp);
END $$;
CREATE OR REPLACE FUNCTION public.fn_facial_link_cancelar(p_aluno_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito à equipe'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('facial_link:'||p_aluno_id::text));
 UPDATE public.facial_links_responsavel SET revogado_em=now() WHERE aluno_id=p_aluno_id AND usado_em IS NULL AND revogado_em IS NULL;
END $$;
CREATE OR REPLACE FUNCTION public.fn_facial_link_status(p_aluno_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.facial_links_responsavel%rowtype; c public.facial_consentimentos%rowtype; e text;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito à equipe'; END IF;
 SELECT * INTO v FROM public.facial_links_responsavel WHERE aluno_id=p_aluno_id ORDER BY criado_em DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('estado','nenhum','expira_em',null,'usado_em',null,'responsavel_nome',null,'parentesco',null); END IF;
 SELECT * INTO c FROM public.facial_consentimentos WHERE id=v.consentimento_id;
 e:=CASE WHEN v.revogado_em IS NOT NULL OR c.revogado_em IS NOT NULL THEN 'revogado' WHEN v.usado_em IS NOT NULL THEN 'usado' WHEN v.expira_em<=now() THEN 'expirado' ELSE 'aberto' END;
 RETURN jsonb_build_object('estado',e,'expira_em',v.expira_em,'usado_em',v.usado_em,'responsavel_nome',CASE WHEN e='usado' THEN c.responsavel_nome END,'parentesco',CASE WHEN e='usado' THEN c.responsavel_parentesco END);
END $$;
CREATE OR REPLACE FUNCTION public.fn_facial_link_consultar(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.facial_links_responsavel%rowtype; m text; n text;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('valido',false,'motivo','invalido','aluno_primeiro_nome',null,'expira_em',null); END IF;
 SELECT * INTO v FROM public.facial_links_responsavel WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 m:=CASE WHEN v.id IS NULL THEN 'invalido' WHEN v.revogado_em IS NOT NULL THEN 'revogado' WHEN v.usado_em IS NOT NULL THEN 'usado' WHEN v.expira_em<=now() THEN 'expirado' ELSE 'ok' END;
 IF m='ok' THEN SELECT split_part(btrim(nome),' ',1) INTO n FROM public.alunos WHERE id=v.aluno_id; END IF;
 RETURN jsonb_build_object('valido',m='ok','motivo',m,'aluno_primeiro_nome',n,'expira_em',CASE WHEN m='ok' THEN v.expira_em END);
END $$;
CREATE OR REPLACE FUNCTION public.fn_facial_link_aceitar(p_token text,p_nome text,p_cpf text,p_parentesco text,p_versao text,p_texto text,p_ip text,p_ua text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.facial_links_responsavel%rowtype; d text; h text; a_hash text; c uuid; s integer; r integer; i integer; k integer; n text;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('ok',false,'erro','Este link não é mais válido. Peça um novo à recepção da FORTEM.'); END IF;
 SELECT * INTO v FROM public.facial_links_responsavel WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 IF v.id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','Este link não é mais válido. Peça um novo à recepção da FORTEM.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('facial_link:'||v.aluno_id::text));
 SELECT * INTO v FROM public.facial_links_responsavel WHERE id=v.id FOR UPDATE;
 IF v.usado_em IS NOT NULL OR v.revogado_em IS NOT NULL OR v.expira_em<=now() THEN RETURN jsonb_build_object('ok',false,'erro','Este link não é mais válido. Peça um novo à recepção da FORTEM.'); END IF;
 n:=regexp_replace(btrim(coalesce(p_nome,'')),'\s+',' ','g');
 IF length(n)>200 OR n !~ '^[[:alpha:]][[:alpha:]''-]* [[:alpha:]]' OR length(regexp_replace(n,'[^[:alpha:]]','','g'))<5 THEN RETURN jsonb_build_object('ok',false,'erro','Informe o nome completo do responsável.'); END IF;
 IF p_parentesco IS NULL OR p_parentesco NOT IN ('mae','pai','responsavel_legal','outro') THEN RETURN jsonb_build_object('ok',false,'erro','Escolha o parentesco do responsável.'); END IF;
 d:=regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
 IF length(d)<>11 OR d ~ '^([0-9])\1{10}$' THEN RETURN jsonb_build_object('ok',false,'erro','Informe um CPF válido.'); END IF;
 FOR k IN 9..10 LOOP
  s:=0; FOR i IN 1..k LOOP s:=s+substring(d,i,1)::integer*(k+2-i); END LOOP;
  r:=(s*10)%11; IF r=10 THEN r:=0; END IF;
  IF r<>substring(d,k+1,1)::integer THEN RETURN jsonb_build_object('ok',false,'erro','Informe um CPF válido.'); END IF;
 END LOOP;
 h:=public.fn_clube_hash_cpf(d);
 SELECT cpf_hash INTO a_hash FROM public.alunos WHERE id=v.aluno_id;
 IF h=a_hash THEN RETURN jsonb_build_object('ok',false,'erro','O CPF deve ser do responsável, não do aluno.'); END IF;
 IF nullif(btrim(p_versao),'') IS NULL OR nullif(btrim(p_texto),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','Não foi possível registrar a autorização.'); END IF;
 SELECT id INTO c FROM public.facial_consentimentos WHERE aluno_id=v.aluno_id AND tipo='responsavel' AND aceito AND revogado_em IS NULL ORDER BY aceito_em DESC LIMIT 1;
 IF c IS NULL THEN
 INSERT INTO public.facial_consentimentos(aluno_id,tipo,origem,aceito,responsavel_nome,responsavel_parentesco,responsavel_cpf_ultimos3,responsavel_cpf_hash,ip_aceite,user_agent,versao_termo,texto_termo)
 VALUES(v.aluno_id,'responsavel','link_responsavel',true,n,p_parentesco,right(d,3),h,left(p_ip,100),left(p_ua,500),p_versao,p_texto) RETURNING id INTO c;
 END IF;
 UPDATE public.facial_links_responsavel SET usado_em=now(),consentimento_id=c WHERE id=v.id;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.fn_facial_link_criar(uuid), public.fn_facial_link_cancelar(uuid), public.fn_facial_link_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_facial_link_criar(uuid), public.fn_facial_link_cancelar(uuid), public.fn_facial_link_status(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_facial_link_consultar(text), public.fn_facial_link_aceitar(text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_facial_link_consultar(text), public.fn_facial_link_aceitar(text,text,text,text,text,text,text,text) TO service_role;