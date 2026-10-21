BEGIN;
DO $test$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; other_u uuid; x uuid; t text; t2 text; j jsonb; c integer; q uuid; q2 uuid; r record; cols text;
BEGIN
 LOCK TABLE public.facial_fila IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.facial_fila WHERE status IN ('pendente','processando')) THEN RAISE EXCEPTION 'Teste interrompido: fila real em andamento'; END IF;
 SELECT user_id INTO u FROM public.user_roles WHERE role='admin' AND public.is_admin(user_id) LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Admin necessário'; END IF;
 BEGIN
 FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','coordenador') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=user_roles.user_id AND ativo=false) LOOP
  PERFORM set_config('request.jwt.claim.sub',r.user_id::text,true);
  IF NOT public.is_coordenador_ou_admin() THEN RAISE EXCEPTION 'A2 ativo recusado'; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO public.alunos(id,nome,data_nascimento,cpf_hash) VALUES(a,'SIMULACAO MENOR PRIVADO','2015-01-01',public.fn_clube_hash_cpf('11144477735')),(b,'SIMULACAO SEM ACEITE','2015-01-01',null);
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.fn_facial_link_criar(a); RAISE EXCEPTION 'Não-staff aceito'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Não-staff aceito' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 j:=public.fn_facial_link_criar(a);t:=j->>'token';
 IF length(t)<>64 OR NOT EXISTS(SELECT 1 FROM public.facial_links_responsavel l WHERE aluno_id=a AND token_hash=encode(extensions.digest(t,'sha256'),'hex') AND position(t in row_to_json(l)::text)=0) THEN RAISE EXCEPTION 'B6.1 hash/token'; END IF;
 IF (j->>'expira_em')::timestamptz<>now()+interval '7 days' THEN RAISE EXCEPTION 'Validade não é 7 dias'; END IF;
 FOREACH cols IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF has_function_privilege(cols,'public.fn_facial_link_consultar(text)','EXECUTE') OR has_function_privilege(cols,'public.fn_facial_link_aceitar(text,text,text,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'B6.2 privilégio indevido'; END IF;
 END LOOP;
 IF NOT has_function_privilege('service_role','public.fn_facial_link_consultar(text)','EXECUTE') OR NOT has_function_privilege('service_role','public.fn_facial_link_aceitar(text,text,text,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Service sem acesso'; END IF;
 j:=public.fn_facial_link_consultar(t);
 IF j->>'aluno_primeiro_nome'<>'SIMULACAO' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(j) key)<>ARRAY['aluno_primeiro_nome','expira_em','motivo','valido'] THEN RAISE EXCEPTION 'B6.3 dados excessivos'; END IF;
 IF (public.fn_facial_link_aceitar(t,'Nome Responsavel','11111111111','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'CPF inválido aceito'; END IF;
 IF (public.fn_facial_link_aceitar(t,'Nome Responsavel','11144477735','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'CPF aluno aceito'; END IF;
 IF (public.fn_facial_link_aceitar(t,'Nome Responsavel','52998224725','irma','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'Parentesco inválido aceito'; END IF;
 IF (public.fn_facial_link_aceitar(t,'Ana','52998224725','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'Nome curto aceito'; END IF;
 j:=public.fn_facial_link_aceitar(t,'Nome Responsavel','52998224725','mae','teste','teste','127.0.0.1','simulacao');
 IF j->>'ok'<>'true' OR NOT EXISTS(SELECT 1 FROM public.facial_consentimentos WHERE aluno_id=a AND tipo='responsavel' AND origem='link_responsavel' AND responsavel_cpf_ultimos3='725' AND responsavel_cpf_hash=public.fn_clube_hash_cpf('52998224725')) THEN RAISE EXCEPTION 'B6.4 aceite válido falhou: %',j; END IF;
 IF (public.fn_facial_link_aceitar(t,'Nome Responsavel','52998224725','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'Reuso aceito'; END IF;
 t:=public.fn_facial_link_criar(b)->>'token'; t2:=public.fn_facial_link_criar(b)->>'token';
 IF public.fn_facial_link_consultar(t)->>'motivo'<>'revogado' OR (public.fn_facial_link_aceitar(t,'Nome Responsavel','52998224725','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'B6.5 revogação falhou'; END IF;
 UPDATE public.facial_links_responsavel SET expira_em=now()-interval '1 second' WHERE aluno_id=b AND revogado_em IS NULL;
 IF public.fn_facial_link_consultar(t2)->>'motivo'<>'expirado' OR (public.fn_facial_link_aceitar(t2,'Nome Responsavel','52998224725','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'Expirado aceito'; END IF;
 IF (public.fn_facial_link_aceitar(repeat('f',64),'Nome Responsavel','52998224725','mae','teste','teste',null,null)->>'ok')::boolean THEN RAISE EXCEPTION 'Inexistente aceito'; END IF;
 t:=public.fn_facial_link_criar(a)->>'token';SELECT count(*) INTO c FROM public.facial_consentimentos WHERE aluno_id=a;
 IF public.fn_facial_link_aceitar(t,'Nome Responsavel','52998224725','mae','teste','teste',null,null)->>'ok'<>'true' OR (SELECT count(*) FROM public.facial_consentimentos WHERE aluno_id=a)<>c THEN RAISE EXCEPTION 'Duplicou consentimento'; END IF;
 INSERT INTO public.credenciais_facial(aluno_id,device_user_id,status,foto_path,foto_origem) VALUES(a,2147483501,'pendente',a::text||'/simulada.jpg','upload'),(b,2147483502,'pendente',b::text||'/simulada.jpg','upload');
 INSERT INTO public.facial_fila(aluno_id,device_user_id,acao) VALUES(a,2147483501,'cadastrar') RETURNING id INTO q;
 INSERT INTO public.facial_fila(aluno_id,device_user_id,acao) VALUES(b,2147483502,'cadastrar') RETURNING id INTO q2;
 j:=public.fn_facial_fila_reservar(10);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(j->'jobs') z WHERE z->>'id'=q::text) OR EXISTS(SELECT 1 FROM jsonb_array_elements(j->'jobs') z WHERE z->>'id'=q2::text) THEN RAISE EXCEPTION 'B6.6 reserva errada'; END IF;
 -- Alterações abaixo ocorrem apenas nesta subtransação e são desfeitas integralmente.
 PERFORM set_config('request.jwt.claim.sub','',true);
 UPDATE public.profiles SET ativo=false WHERE user_id=u;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 IF public.is_coordenador_ou_admin() THEN RAISE EXCEPTION 'A2 inativo aceito'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 UPDATE public.profiles SET ativo=true WHERE user_id=u;
 UPDATE public.profiles SET ativo=false WHERE user_id IN(SELECT user_id FROM public.user_roles WHERE role='admin' AND user_id<>u);
 IF EXISTS(SELECT 1 FROM public.user_roles r WHERE role='admin' AND user_id<>u AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=r.user_id AND ativo=false)) THEN RAISE EXCEPTION 'Teste A3 requer perfil em todos os admins'; END IF;
 BEGIN DELETE FROM public.user_roles WHERE user_id=u AND role='admin'; RAISE EXCEPTION 'Último admin removido'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Último admin removido' THEN RAISE; END IF; END;
 RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback de todas as simulações';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF (SELECT count(*) FROM public.credenciais_facial)<>227 OR (SELECT count(*) FROM public.facial_consentimentos)<>1 OR (SELECT count(*) FROM public.facial_fila)<>1 THEN RAISE EXCEPTION 'Contagens alteradas'; END IF;
 RAISE NOTICE 'PASSOU A2/A3 e B6.1–6; todos os dados revertidos';
END $test$;
ROLLBACK;
