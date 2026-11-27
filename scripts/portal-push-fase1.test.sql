-- Ensaios com cadastros temporários; todos os dados e efeitos laterais são revertidos.
BEGIN;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  mensal uuid := gen_random_uuid();
  fixo uuid := gen_random_uuid();
  total integer;
BEGIN
  INSERT INTO public.alunos(id, nome, status, is_equipe)
  VALUES (a, 'Fixture push plano', 'ativo', false);

  INSERT INTO public.planos(id, aluno_id, tipo, data_inicio, data_fim, duracao_meses, ativo, renovacao_automatica, atividade)
  VALUES
    (fixo, a, 'Power', '2026-01-10', '2026-12-01', 12, true, false, 'treinamento_funcional'),
    (mensal, a, 'Start', '2026-10-02', '2026-12-01', 1, true, true, 'treinamento_funcional');

  SELECT count(*) INTO total
  FROM public.fn_portal_push_avisos('2026-11-01')
  WHERE aluno_id = a AND gatilho = 'plano_vencendo_30d' AND referencia = 'plano:' || fixo::text;
  IF total <> 1 THEN RAISE EXCEPTION 'Plano com prazo fixo não foi selecionado uma vez'; END IF;

  SELECT count(*) INTO total
  FROM public.fn_portal_push_avisos('2026-11-01')
  WHERE aluno_id = a AND gatilho = 'plano_vencendo_30d' AND referencia = 'plano:' || mensal::text;
  IF total <> 0 THEN RAISE EXCEPTION 'Plano mensal com renovação automática recebeu aviso de 30 dias'; END IF;

  RAISE NOTICE 'Ensaio plano fixo x mensal passou';
END;
$test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  avaliador uuid;
  agenda uuid := gen_random_uuid();
  d integer;
  total integer;
  primeira text;
  segunda text;
BEGIN
  SELECT r.user_id INTO avaliador
  FROM public.user_roles r
  JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.role = 'professor' AND p.ativo
  LIMIT 1;
  IF avaliador IS NULL THEN RAISE EXCEPTION 'Fixture exige professor ativo'; END IF;

  INSERT INTO public.alunos(id, nome, status, is_equipe)
  VALUES (a, 'Fixture push reavaliação', 'ativo', false);
  INSERT INTO public.avaliacoes(aluno_id, avaliador_id, tipo, data, dados)
  VALUES (a, avaliador, 'funcional_v2', '2026-01-01', '{\"status\":\"rascunho\"}');

  FOR d IN 0..15 LOOP
    INSERT INTO public.portal_push_log(aluno_id, gatilho, referencia, title, sucesso, erro_detalhe)
    SELECT a, 'reavaliacao_pendente', f.referencia, 'Sem dispositivo', false, 'sem_inscricao'
    FROM public.fn_portal_push_avisos(('2026-05-02'::date + d)) f
    WHERE f.aluno_id = a AND f.gatilho = 'reavaliacao_pendente'
    ON CONFLICT (aluno_id, gatilho, referencia) WHERE referencia IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS total = ROW_COUNT;
    IF total <> (CASE WHEN d IN (0, 15) THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'Reavaliação fora da janela no dia %: % avisos', d + 1, total;
    END IF;
  END LOOP;

  SELECT referencia INTO primeira
  FROM public.fn_portal_push_avisos('2026-05-02')
  WHERE aluno_id = a AND gatilho = 'reavaliacao_pendente';
  SELECT referencia INTO segunda
  FROM public.fn_portal_push_avisos('2026-05-17')
  WHERE aluno_id = a AND gatilho = 'reavaliacao_pendente';
  IF primeira IS NULL OR segunda IS NULL OR primeira = segunda THEN
    RAISE EXCEPTION 'Janelas do dia 1 e dia 16 não têm referências distintas';
  END IF;

  INSERT INTO public.agenda_servicos(id, aluno_id, profissional_id, atividade, local, dia_semana, tipo, data_especifica, horario_inicio, horario_fim)
  VALUES (agenda, a, avaliador, 'Avaliação Funcional', 'FORTEM MATRIZ', 3, 'avulso', '2026-05-20', '10:00', '11:00');
  SELECT count(*) INTO total
  FROM public.fn_portal_push_avisos('2026-05-17')
  WHERE aluno_id = a AND gatilho = 'reavaliacao_pendente';
  IF total <> 0 THEN RAISE EXCEPTION 'Agendamento de avaliação não interrompeu a reavaliação'; END IF;

  DELETE FROM public.agenda_servicos WHERE id = agenda;
  INSERT INTO public.avaliacoes(aluno_id, avaliador_id, tipo, data, dados)
  VALUES (a, avaliador, 'funcional_v2', '2026-05-17', '{\"status\":\"rascunho\"}');
  SELECT count(*) INTO total
  FROM public.fn_portal_push_avisos('2026-05-17')
  WHERE aluno_id = a AND gatilho = 'reavaliacao_pendente';
  IF total <> 0 THEN RAISE EXCEPTION 'Nova avaliação não interrompeu a reavaliação'; END IF;

  RAISE NOTICE 'Ensaio reavaliação dia 1/dia 16, agenda e nova avaliação passou';
END;
$test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  credito uuid := gen_random_uuid();
  ref_dia1 text;
  ref_dia2 text;
  total integer;
BEGIN
  INSERT INTO public.alunos(id, nome, status, is_equipe)
  VALUES (a, 'Fixture push créditos', 'ativo', false);
  INSERT INTO public.creditos_aluno(id, aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, quantidade_usada, ilimitado, competencia, ativo)
  VALUES (credito, a, 'plano', credito, 'Treino', 10, 8, false, '2026-11-01', true);

  SELECT referencia INTO ref_dia1 FROM public.fn_portal_push_avisos('2026-11-10')
  WHERE aluno_id = a AND gatilho = 'creditos_baixos';
  SELECT referencia INTO ref_dia2 FROM public.fn_portal_push_avisos('2026-11-11')
  WHERE aluno_id = a AND gatilho = 'creditos_baixos';
  IF ref_dia1 IS NULL OR ref_dia1 <> ref_dia2 THEN RAISE EXCEPTION 'Ciclo mudou a referência entre dias'; END IF;

  INSERT INTO public.portal_push_log(aluno_id, gatilho, referencia, title, sucesso, erro_detalhe)
  VALUES (a, 'creditos_baixos', ref_dia1, 'Sem dispositivo', false, 'sem_inscricao');
  BEGIN
    INSERT INTO public.portal_push_log(aluno_id, gatilho, referencia, title, sucesso)
    VALUES (a, 'creditos_baixos', ref_dia1, 'Duplicado', true);
    RAISE EXCEPTION 'Rotina repetida duplicou o mesmo ciclo';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  SELECT count(*) INTO total FROM public.portal_push_log
  WHERE aluno_id = a AND gatilho = 'creditos_baixos' AND referencia = ref_dia1;
  IF total <> 1 THEN RAISE EXCEPTION 'Reserva sem inscrição não ficou idempotente'; END IF;

  RAISE NOTICE 'Ensaio créditos por ciclo, sem inscrição e execução repetida passou';
END;
$test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  cobranca uuid := gen_random_uuid();
  contrato uuid := gen_random_uuid();
  mensalidade uuid;
  d integer;
  total integer;
BEGIN
  INSERT INTO public.alunos(id, nome, status, is_equipe)
  VALUES (a, 'Fixture push atraso', 'ativo', false);
  INSERT INTO public.contratos(id, aluno_id, plano_tipo, vigencia_tipo, data_inicio, forma_pagamento, valor_base, valor_cobrado)
  VALUES (contrato, a, 'start', 'mensal', '2026-10-01', 'pix', 399.90, 399.90);
  INSERT INTO public.cobrancas(id, aluno_id, contrato_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento)
  VALUES (cobranca, a, contrato, 1, 399.90, '2026-10-25', 'atrasado', 'pix');

  FOR d IN 0..7 LOOP
    SELECT count(*) INTO total
    FROM public.fn_portal_push_avisos('2026-10-25'::date + d)
    WHERE aluno_id = a AND gatilho = 'cobranca_atrasada';
    IF total <> (CASE WHEN d IN (1, 3, 7) THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'Atraso fora do marco D+%: % avisos', d, total;
    END IF;
  END LOOP;

  SELECT m.id INTO mensalidade FROM public.planos_2027_mensalidades m
  WHERE NOT EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.mensalidade_2027_id = m.id)
  LIMIT 1;
  IF mensalidade IS NULL THEN RAISE EXCEPTION 'Fixture exige uma mensalidade 2027 existente'; END IF;
  UPDATE public.cobrancas SET mensalidade_2027_id = mensalidade WHERE id = cobranca;
  SELECT count(*) INTO total
  FROM public.fn_portal_push_avisos('2026-10-26')
  WHERE aluno_id = a AND gatilho = 'cobranca_atrasada';
  IF total <> 0 THEN RAISE EXCEPTION 'Mensalidade 2027 do site recebeu push do aluno'; END IF;

  RAISE NOTICE 'Ensaio atraso D+1/D+3/D+7 e exclusão 2027 passou';
END;
$test$;

DO $test$
DECLARE
  a uuid := gen_random_uuid();
  inativo uuid := gen_random_uuid();
  total integer;
  anos integer;
BEGIN
  INSERT INTO public.alunos(id, nome, status, is_equipe, aluno_desde)
  VALUES
    (a, 'Fixture push aniversário', 'ativo', false, '2024-11-27'),
    (inativo, 'Fixture push aniversário inativo', 'inativo', false, '2024-11-27');

  SELECT count(*), max(f.anos) INTO total, anos
  FROM public.fn_portal_push_avisos('2026-11-27') f
  WHERE f.aluno_id = a AND f.gatilho = 'aniversario_fortem';
  IF total <> 1 OR anos <> 2 THEN RAISE EXCEPTION 'Aniversário FORTEM não usou cliente desde'; END IF;

  SELECT count(*) INTO total FROM public.fn_portal_push_avisos('2026-11-26')
  WHERE aluno_id = a AND gatilho = 'aniversario_fortem';
  IF total <> 0 THEN RAISE EXCEPTION 'Aniversário disparou antes da data'; END IF;
  SELECT count(*) INTO total FROM public.fn_portal_push_avisos('2026-11-28')
  WHERE aluno_id = a AND gatilho = 'aniversario_fortem';
  IF total <> 0 THEN RAISE EXCEPTION 'Aniversário disparou depois da data'; END IF;
  SELECT count(*) INTO total FROM public.fn_portal_push_avisos('2026-11-27')
  WHERE aluno_id = inativo AND gatilho = 'aniversario_fortem';
  IF total <> 0 THEN RAISE EXCEPTION 'Aluno inativo recebeu aniversário FORTEM'; END IF;

  RAISE NOTICE 'Ensaio aniversário FORTEM por cliente desde e aluno ativo passou';
END;
$test$;

ROLLBACK;
