-- Fixtures independentes de cadastros reais; nenhuma alteração persiste.
BEGIN;
DO $fixture$

DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; t uuid:=gen_random_uuid(); av uuid; n integer;
BEGIN
 SELECT r.user_id INTO u FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id WHERE r.role='professor' AND p.ativo LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Fixture exige professor'; END IF;
 INSERT INTO public.alunos(id,nome,status,responsavel_id) VALUES(a,'Fixture registros técnicos','ativo',u),(b,'Fixture aluno inativo','inativo',u);


    INSERT INTO public.tarefas(titulo,aluno_id,responsavel_id,criado_por_id,tipo_auto) VALUES('Fixture',b,u,u,'reavaliacao_funcional'),('Onda concluída',b,u,u,'treino_onda_concluida');
    IF EXISTS(SELECT 1 FROM public.tarefas WHERE aluno_id=b) THEN RAISE EXCEPTION 'Inativo recebeu tarefa'; END IF;
  
RAISE NOTICE 'Ensaio 1 passou';
END;
$fixture$;
DO $fixture$

DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; t uuid:=gen_random_uuid(); av uuid; n integer;
BEGIN
 SELECT r.user_id INTO u FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id WHERE r.role='professor' AND p.ativo LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Fixture exige professor'; END IF;
 INSERT INTO public.alunos(id,nome,status,responsavel_id) VALUES(a,'Fixture registros técnicos','ativo',u),(b,'Fixture aluno inativo','inativo',u);


    INSERT INTO public.tarefas(titulo,aluno_id,responsavel_id,criado_por_id,tipo_auto,status) VALUES('Fixture',a,u,u,'reavaliacao_funcional','pendente'),('Histórico',a,u,u,'atualizar_treino','concluida');
    UPDATE public.alunos SET status='inativo' WHERE id=a;
    IF EXISTS(SELECT 1 FROM public.tarefas WHERE aluno_id=a AND status<>'concluida') THEN RAISE EXCEPTION 'Pendente não foi removida'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.tarefas WHERE aluno_id=a AND status='concluida') THEN RAISE EXCEPTION 'Histórico removido'; END IF;
  
RAISE NOTICE 'Ensaio 2 passou';
END;
$fixture$;
DO $fixture$

DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; t uuid:=gen_random_uuid(); av uuid; n integer;
BEGIN
 SELECT r.user_id INTO u FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id WHERE r.role='professor' AND p.ativo LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Fixture exige professor'; END IF;
 INSERT INTO public.alunos(id,nome,status,responsavel_id) VALUES(a,'Fixture registros técnicos','ativo',u),(b,'Fixture aluno inativo','inativo',u);


    INSERT INTO public.tarefas(titulo,aluno_id,responsavel_id,criado_por_id,tipo_auto) VALUES('Fixture',a,u,u,'atualizar_treino');
    UPDATE public.alunos SET current_pipeline_stage_id=(SELECT s.id FROM public.pipeline_stages s JOIN public.pipeline_funnels f ON f.id=s.funnel_id WHERE f.slug='inativo' LIMIT 1) WHERE id=a;
    IF EXISTS(SELECT 1 FROM public.tarefas WHERE aluno_id=a) THEN RAISE EXCEPTION 'Funil inativo manteve tarefa'; END IF;
  
RAISE NOTICE 'Ensaio 3 passou';
END;
$fixture$;
DO $fixture$

DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; t uuid:=gen_random_uuid(); av uuid; n integer;
BEGIN
 SELECT r.user_id INTO u FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id WHERE r.role='professor' AND p.ativo LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Fixture exige professor'; END IF;
 INSERT INTO public.alunos(id,nome,status,responsavel_id) VALUES(a,'Fixture registros técnicos','ativo',u),(b,'Fixture aluno inativo','inativo',u);


    INSERT INTO public.treinos(id,aluno_id,autor_id,descricao,conteudo,status,versao) VALUES(t,a,u,'Fixture','{}','atual',1);
    IF NOT EXISTS(SELECT 1 FROM public.tarefas WHERE treino_id=t AND status='pendente') THEN RAISE EXCEPTION 'Sem tarefa do treino'; END IF;
    INSERT INTO public.avaliacoes(aluno_id,avaliador_id,tipo,treino_id,dados) VALUES(a,u,'relatorioforca',t,'{"status":"rascunho"}') RETURNING id INTO av;
    IF EXISTS(SELECT 1 FROM public.notificacoes WHERE aluno_id=a) THEN RAISE EXCEPTION 'Rascunho notificou'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.tarefas WHERE treino_id=t AND status='pendente') THEN RAISE EXCEPTION 'Rascunho concluiu'; END IF;
    UPDATE public.avaliacoes SET dados='{"status":"finalizado"}' WHERE id=av;
    IF NOT EXISTS(SELECT 1 FROM public.tarefas WHERE treino_id=t AND status='concluida') THEN RAISE EXCEPTION 'Finalização não concluiu'; END IF;
    IF (SELECT count(*) FROM public.notificacoes WHERE aluno_id=a)<>1 THEN RAISE EXCEPTION 'Aviso ausente/duplicado'; END IF;
    IF EXISTS(SELECT 1 FROM public.notificacao_destinatarios d JOIN public.notificacoes no ON no.id=d.notificacao_id WHERE no.aluno_id=a AND (d.usuario_id=u OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=d.usuario_id AND r.role IN ('admin','coordenador')))) THEN RAISE EXCEPTION 'Destinatário incorreto'; END IF;
    UPDATE public.avaliacoes SET observacoes='Edição' WHERE id=av;
    IF (SELECT count(*) FROM public.notificacoes WHERE aluno_id=a)<>1 THEN RAISE EXCEPTION 'Edição duplicou aviso'; END IF;
  
RAISE NOTICE 'Ensaio 4 passou';
END;
$fixture$;
DO $fixture$

DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; t uuid:=gen_random_uuid(); av uuid; n integer;
BEGIN
 SELECT r.user_id INTO u FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id WHERE r.role='professor' AND p.ativo LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Fixture exige professor'; END IF;
 INSERT INTO public.alunos(id,nome,status,responsavel_id) VALUES(a,'Fixture registros técnicos','ativo',u),(b,'Fixture aluno inativo','inativo',u);


    INSERT INTO public.avaliacoes(aluno_id,avaliador_id,tipo,dados) VALUES(a,u,'experimental','{}') RETURNING id INTO av;
    BEGIN
      UPDATE public.avaliacoes SET avaliador_id=gen_random_uuid() WHERE id=av;
      RAISE EXCEPTION 'Autor foi trocado';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='Autor foi trocado' THEN RAISE; END IF;
    END;
    IF (SELECT avaliador_id FROM public.avaliacoes WHERE id=av)<>u THEN RAISE EXCEPTION 'Autor não preservado'; END IF;
  
RAISE NOTICE 'Ensaio 5 passou';
END;
$fixture$;
ROLLBACK;
