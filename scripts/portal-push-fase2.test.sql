-- Todos os cadastros, avisos e requisições de teste são revertidos; nenhum push é entregue.
BEGIN;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  inativo uuid := gen_random_uuid();
  ref text;
  total integer;
BEGIN
  INSERT INTO public.alunos(id,nome,status,is_equipe,data_nascimento) VALUES
    (a,'Maria da Silva','ativo',false,'1990-11-28'),
    (inativo,'João Inativo','inativo',false,'1990-11-28');

  SELECT referencia INTO ref FROM public.fn_portal_push_avisos_fase2('2026-11-28')
  WHERE aluno_id=a AND gatilho='aniversario_aluno';
  IF ref IS NULL THEN RAISE EXCEPTION 'Aniversário não saiu no dia'; END IF;
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-11-27') WHERE aluno_id=a AND gatilho='aniversario_aluno') THEN
    RAISE EXCEPTION 'Aniversário saiu antes';
  END IF;
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-11-29') WHERE aluno_id=a AND gatilho='aniversario_aluno') THEN
    RAISE EXCEPTION 'Aniversário saiu depois';
  END IF;
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-11-28') WHERE aluno_id=inativo AND gatilho='aniversario_aluno') THEN
    RAISE EXCEPTION 'Inativo recebeu aniversário';
  END IF;

  INSERT INTO public.portal_push_log(aluno_id,gatilho,referencia,title,sucesso,erro_detalhe)
  VALUES(a,'aniversario_aluno',ref,'Sem dispositivo',false,'sem_inscricao')
  ON CONFLICT (aluno_id,gatilho,referencia) WHERE referencia IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>1 THEN RAISE EXCEPTION 'Primeira reserva anual falhou'; END IF;
  INSERT INTO public.portal_push_log(aluno_id,gatilho,referencia,title,sucesso,erro_detalhe)
  VALUES(a,'aniversario_aluno',ref,'Sem dispositivo',false,'sem_inscricao')
  ON CONFLICT (aluno_id,gatilho,referencia) WHERE referencia IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>0 THEN RAISE EXCEPTION 'Aniversário duplicou no mesmo ano'; END IF;
  RAISE NOTICE 'Ensaio aniversário passou';
END $test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  contrato uuid := gen_random_uuid();
  d1 uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  d integer;
  total integer;
  docs integer;
BEGIN
  INSERT INTO public.alunos(id,nome,status,is_equipe) VALUES(a,'Fixture documentos','ativo',false);
  INSERT INTO public.contratos(id,aluno_id,plano_tipo,vigencia_tipo,data_inicio,forma_pagamento,valor_base,valor_cobrado)
  VALUES(contrato,a,'start','mensal','2026-01-01','pix',399,399);
  INSERT INTO public.contratos_documentos(id,contrato_id,aluno_id,template_id,template_versao,regulamento_versao,conteudo_gerado,aceite)
  VALUES
    (d1,contrato,a,NULL,1,1,'Contrato antigo sem template',false),
    (d2,contrato,a,NULL,1,1,'Segundo contrato antigo',false);

  FOR d IN 0..7 LOOP
    INSERT INTO public.portal_push_log(aluno_id,gatilho,referencia,title,sucesso,erro_detalhe)
    SELECT a,'documentos_pendentes',f.referencia,'Sem dispositivo',false,'sem_inscricao'
    FROM public.fn_portal_push_avisos_fase2('2026-11-23'::date+d) f
    WHERE f.aluno_id=a AND f.gatilho='documentos_pendentes'
    ON CONFLICT (aluno_id,gatilho,referencia) WHERE referencia IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS total=ROW_COUNT;
    IF total<>(CASE WHEN d IN (0,7) THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'Documento fora da regra semanal no dia %: %',d,total;
    END IF;
  END LOOP;

  SELECT f.documentos INTO docs FROM public.fn_portal_push_avisos_fase2('2026-11-30') f
  WHERE f.aluno_id=a AND f.gatilho='documentos_pendentes';
  IF docs<>2 THEN RAISE EXCEPTION 'Nem todos os documentos foram contados'; END IF;
  UPDATE public.contratos_documentos SET aceite=true WHERE id=d1;
  SELECT f.documentos INTO docs FROM public.fn_portal_push_avisos_fase2('2026-11-30') f
  WHERE f.aluno_id=a AND f.gatilho='documentos_pendentes';
  IF docs<>1 THEN RAISE EXCEPTION 'Aceite parcial não reduziu a pendência'; END IF;
  UPDATE public.contratos_documentos SET aceite=true WHERE id=d2;
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-11-30') WHERE aluno_id=a AND gatilho='documentos_pendentes') THEN
    RAISE EXCEPTION 'Documentos continuaram após aceite total';
  END IF;
  RAISE NOTICE 'Ensaio documentos semanal e aceite passou';
END $test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  sem_checkin uuid := gen_random_uuid();
  plano uuid := gen_random_uuid();
  d integer;
  total integer;
  ref_antiga text;
  ref_nova text;
BEGIN
  INSERT INTO public.alunos(id,nome,status,is_equipe) VALUES
    (a,'Fixture agregadora','ativo',false),
    (sem_checkin,'Fixture sem check-in','ativo',false);
  INSERT INTO public.contratos(id,aluno_id,plano_tipo,vigencia_tipo,data_inicio,data_fim,forma_pagamento,valor_base,valor_cobrado,created_at)
  VALUES(gen_random_uuid(),a,'gympass','mensal','2026-11-01','2026-12-01','dinheiro',0,0,'2026-11-01 12:00:00+00');

  FOR d IN 1..30 LOOP
    SELECT count(*) INTO total FROM public.fn_portal_push_avisos_fase2('2026-11-01'::date+d)
    WHERE aluno_id=a AND gatilho='baixa_frequencia';
    IF total<>(CASE WHEN d IN (7,10,15,20,30) THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'Baixa frequência fora do marco %: %',d,total;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-12-01') WHERE aluno_id=sem_checkin AND gatilho='baixa_frequencia') THEN
    RAISE EXCEPTION 'Aluno sem check-in recebeu baixa frequência';
  END IF;

  SELECT referencia INTO ref_antiga FROM public.fn_portal_push_avisos_fase2('2026-11-08')
  WHERE aluno_id=a AND gatilho='baixa_frequencia';
  INSERT INTO public.portal_push_log(aluno_id,gatilho,referencia,title,sucesso,erro_detalhe)
  VALUES(a,'baixa_frequencia',ref_antiga,'Sem dispositivo',false,'sem_inscricao')
  ON CONFLICT (aluno_id,gatilho,referencia) WHERE referencia IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>1 THEN RAISE EXCEPTION 'Primeira ausência não foi reservada'; END IF;
  INSERT INTO public.portal_push_log(aluno_id,gatilho,referencia,title,sucesso,erro_detalhe)
  VALUES(a,'baixa_frequencia',ref_antiga,'Sem dispositivo',false,'sem_inscricao')
  ON CONFLICT (aluno_id,gatilho,referencia) WHERE referencia IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>0 THEN RAISE EXCEPTION 'Ausência duplicou no mesmo marco'; END IF;
  INSERT INTO public.contratos(id,aluno_id,plano_tipo,vigencia_tipo,data_inicio,data_fim,forma_pagamento,valor_base,valor_cobrado,created_at)
  VALUES(gen_random_uuid(),a,'gympass','mensal','2026-11-01','2026-12-01','dinheiro',0,0,'2026-11-12 12:00:00+00');
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-11-15') WHERE aluno_id=a AND gatilho='baixa_frequencia') THEN
    RAISE EXCEPTION 'Novo check-in não reiniciou a ausência';
  END IF;
  SELECT referencia INTO ref_nova FROM public.fn_portal_push_avisos_fase2('2026-11-19')
  WHERE aluno_id=a AND gatilho='baixa_frequencia';
  IF ref_nova IS NULL OR ref_nova=ref_antiga THEN RAISE EXCEPTION 'Novo período não gerou nova referência'; END IF;

  INSERT INTO public.planos(id,aluno_id,tipo,data_inicio,data_fim,duracao_meses,ativo,renovacao_automatica,atividade)
  VALUES(plano,a,'Power','2026-11-01','2026-12-01',1,true,true,'treinamento_funcional');
  INSERT INTO public.aluno_licencas(aluno_id,plano_id,tipo,data_inicio,data_fim,dias,criado_por)
  SELECT a,plano,'plano','2026-11-10','2026-11-19',10,r.user_id FROM public.user_roles r WHERE r.role='admin' LIMIT 1;
  IF EXISTS(SELECT 1 FROM public.fn_portal_push_avisos_fase2('2026-11-19') WHERE aluno_id=a AND gatilho='baixa_frequencia') THEN
    RAISE EXCEPTION 'Plano congelado recebeu baixa frequência';
  END IF;
  RAISE NOTICE 'Ensaio baixa frequência, agregadora, retorno e congelamento passou';
END $test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid();
  b4 uuid := gen_random_uuid();
  total integer;
  corpo text;
BEGIN
  INSERT INTO public.alunos(id,nome,status,is_equipe) VALUES(a,'Fixture conquista','ativo',false);
  INSERT INTO public.clube_badges(id,codigo,nome,descricao,criterio,pontos_bonus) VALUES
    (b1,'fixture_conquista_25','Conquista 25','Fixture','Fixture',25),
    (b2,'fixture_conquista_0','Conquista Zero','Fixture','Fixture',0),
    (b3,'fixture_conquista_carga','Conquista Carga','Fixture','Fixture',10),
    (b4,'fixture_conquista_backfill','Conquista Backfill','Fixture','Fixture',10);

  INSERT INTO public.clube_aluno_badges(aluno_id,badge_id) VALUES(a,b3);
  SELECT count(*) INTO total FROM net.http_request_queue
  WHERE (convert_from(body,'UTF8')::jsonb)->>'gatilho'='conquista' AND (convert_from(body,'UTF8')::jsonb)->>'aluno_id'=a::text;
  IF total<>0 THEN RAISE EXCEPTION 'Carga direta disparou push'; END IF;

  PERFORM public.fn_clube_conceder_badge(a,'Conquista 25');
  PERFORM public.fn_clube_conceder_badge(a,'Conquista 25');
  SELECT count(*),max((convert_from(body,'UTF8')::jsonb)->>'body') INTO total,corpo FROM net.http_request_queue
  WHERE (convert_from(body,'UTF8')::jsonb)->>'gatilho'='conquista' AND (convert_from(body,'UTF8')::jsonb)->>'aluno_id'=a::text;
  IF total<>1 OR corpo<>'Você desbloqueou Conquista 25 e ganhou 25 pontos no Clube FORTEM.' THEN
    RAISE EXCEPTION 'Conquista individual não saiu uma vez com pontos: %',total;
  END IF;

  PERFORM public.fn_clube_conceder_badge(a,'Conquista Zero');
  SELECT count(*),max((convert_from(body,'UTF8')::jsonb)->>'body') FILTER(WHERE (convert_from(body,'UTF8')::jsonb)->>'title'='Nova conquista: Conquista Zero')
  INTO total,corpo FROM net.http_request_queue
  WHERE (convert_from(body,'UTF8')::jsonb)->>'gatilho'='conquista' AND (convert_from(body,'UTF8')::jsonb)->>'aluno_id'=a::text;
  IF total<>2 OR corpo<>'Você desbloqueou Conquista Zero no Clube FORTEM.' THEN
    RAISE EXCEPTION 'Conquista sem pontos incorreta';
  END IF;

  PERFORM set_config('fortem.clube_backfill','on',true);
  PERFORM public.fn_clube_conceder_badge(a,'Conquista Backfill');
  SELECT count(*) INTO total FROM net.http_request_queue
  WHERE (convert_from(body,'UTF8')::jsonb)->>'gatilho'='conquista' AND (convert_from(body,'UTF8')::jsonb)->>'aluno_id'=a::text;
  IF total<>2 THEN RAISE EXCEPTION 'Backfill disparou push'; END IF;
  RAISE NOTICE 'Ensaio conquista individual e sem lote passou';
END $test$;

ROLLBACK;
