-- E5b-A ENSAIO (transação desfeita: termina sempre em RAISE EXCEPTION; nada fica gravado)
-- Fases antes/depois; cada cenário roda num sub-bloco desfeito. Impressão digital sem ids/timestamps/referências.
DO $ens$
DECLARE
  aluno constant uuid := '085acf57-2dbe-464d-9acc-e1b0f5b77032';
  staff constant uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  fake_uid uuid;  -- login real de aluno (sem papel de equipe), emprestado só dentro da transação
  slot constant uuid := 'ce3a980f-9b45-4da6-bb41-527991f063a9';   -- treino, segunda 06:00
  tpl  constant uuid := '3569cf5c-5308-475d-bbac-e46d26c10c05';   -- Reabilitação fixo, segunda 16:30
  dia  constant date := '2026-10-26';
  cats jsonb := jsonb_build_object('start','c7292e78-e758-4088-a073-059e15f2910d','power','42e1e025-906e-472f-8f88-d45a18fc8bd8',
                                   'pro','559ce8ff-43fa-4768-bfca-0ad6e376bc6d','consultoria','c958faf4-f3ba-4b8f-960a-019b4c31aa38');
  cens text[] := ARRAY['start','power','pro','sem_plano','consultoria','consultoria+start','equipe_consultoria'];
  fase text; cen text; f text; res text; r1 jsonb; r2 jsonb; k uuid; antes text; depois text;
  out jsonb := '{}'; meta_a text; meta_d text;
  g constant text := E'\n  -- E5b: aluno só com Consultoria Online não agenda pelo app (equipe usa fn_agendar_servico_equipe)\n  IF public.fn_aluno_somente_online(_aluno_id) THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''somente_online'');\n  END IF;\n';
  bt constant text := E'  IF _aluno_id IS NULL THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''nao_autenticado'');\n  END IF;\n';
  bs constant text := E'  IF _aluno_id IS NULL THEN\n    RETURN jsonb_build_object(''ok'', false, ''erro'', ''aluno_nao_encontrado'');\n  END IF;\n';
BEGIN
  SELECT u.id INTO fake_uid FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role <> 'aluno')
     AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id=u.id AND pr.ativo=false)
   ORDER BY (SELECT count(*) FROM alunos a WHERE a.user_id=u.id), u.created_at LIMIT 1;
  SELECT string_agg(p.oid::regprocedure||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||p.proconfig::text||'|'||p.proacl::text||'|'||pg_get_function_result(p.oid), ' ; ' ORDER BY 1)
    INTO meta_a FROM pg_proc p WHERE p.oid IN ('fn_agendar_treino(uuid,date)'::regprocedure,'fn_agendar_servico(uuid,date)'::regprocedure);
  FOREACH fase IN ARRAY ARRAY['antes','depois'] LOOP
    IF fase = 'depois' THEN
      -- mesmo texto de consultoria-online-e5b.proposta.sql (gerado pela mesma inserção)
      EXECUTE replace(pg_get_functiondef('fn_agendar_treino(uuid,date)'::regprocedure), bt, bt||g);
      EXECUTE replace(pg_get_functiondef('fn_agendar_servico(uuid,date)'::regprocedure), bs, bs||g);
    END IF;
    FOREACH cen IN ARRAY cens LOOP
      res := NULL;
      BEGIN
        UPDATE alunos SET user_id = NULL WHERE user_id = fake_uid;
        UPDATE alunos SET user_id = fake_uid WHERE id = aluno;
        UPDATE planos SET ativo = false WHERE aluno_id = aluno AND ativo;
        UPDATE creditos_aluno SET ativo = false WHERE aluno_id = aluno AND ativo;
        FOREACH f IN ARRAY (CASE cen WHEN 'sem_plano' THEN ARRAY[]::text[] WHEN 'consultoria+start' THEN ARRAY['consultoria','start']
                                 WHEN 'equipe_consultoria' THEN ARRAY['consultoria'] ELSE ARRAY[cen] END) LOOP
          INSERT INTO planos (aluno_id, catalogo_id, tipo, atividade, ativo, data_inicio, data_fim)
          SELECT aluno, c.id, c.nome, c.atividade, true, current_date, current_date + 30 FROM planos_catalogo c WHERE c.id = (cats->>f)::uuid;
        END LOOP;
        -- créditos idênticos em todos os cenários (para a recusa não vir de falta de crédito)
        UPDATE ciclos_credito cc SET status = 'expirado' FROM contratos c WHERE c.id = cc.contrato_id AND c.aluno_id = aluno AND cc.status = 'ativo';
        UPDATE creditos_aluno SET ativo = false WHERE aluno_id = aluno AND ativo;
        INSERT INTO contratos (aluno_id, plano_tipo, vigencia_tipo, data_inicio, data_fim, forma_pagamento, valor_base, valor_cobrado, status)
        VALUES (aluno, 'outro', 'mensal', current_date, current_date + 30, 'pix', 0, 0, 'ativo') RETURNING id INTO k;
        DELETE FROM ciclos_credito WHERE contrato_id = k;
        INSERT INTO ciclos_credito (contrato_id, creditos_liberados, creditos_usados, data_inicio, data_fim, status)
        VALUES (k, 5, 0, current_date, current_date + 30, 'ativo');
        INSERT INTO creditos_aluno (aluno_id, origem_tipo, atividade, quantidade_inicial, quantidade_usada, ativo, data_validade)
        VALUES (aluno, 'plano', 'Reabilitação', 2, 0, true, current_date + 30);
        antes := (SELECT concat_ws('/', (SELECT count(*) FROM treino_agendamentos WHERE aluno_id=aluno), (SELECT count(*) FROM agenda_servicos WHERE aluno_id=aluno),
                  (SELECT count(*) FROM consumo_servicos WHERE aluno_id=aluno), (SELECT sum(creditos_usados) FROM ciclos_credito WHERE contrato_id=k),
                  (SELECT sum(quantidade_usada) FROM creditos_aluno WHERE aluno_id=aluno AND ativo), (SELECT count(*) FROM agenda_servicos_excecoes WHERE agenda_id=tpl)));
        IF cen = 'equipe_consultoria' THEN
          PERFORM set_config('request.jwt.claims', json_build_object('sub',staff,'role','authenticated')::text, true);
          r1 := NULL;
          r2 := public.fn_agendar_servico_equipe(p_aluno_id => aluno, p_agenda_servico_id => tpl, p_data => dia);
        ELSE
          PERFORM set_config('request.jwt.claims', json_build_object('sub',fake_uid,'role','authenticated')::text, true);
          r1 := public.fn_agendar_treino(slot, dia);
          r2 := public.fn_agendar_servico(tpl, dia);
        END IF;
        PERFORM set_config('request.jwt.claims', '', true);
        depois := (SELECT concat_ws('/', (SELECT count(*) FROM treino_agendamentos WHERE aluno_id=aluno), (SELECT count(*) FROM agenda_servicos WHERE aluno_id=aluno),
                  (SELECT count(*) FROM consumo_servicos WHERE aluno_id=aluno), (SELECT sum(creditos_usados) FROM ciclos_credito WHERE contrato_id=k),
                  (SELECT sum(quantidade_usada) FROM creditos_aluno WHERE aluno_id=aluno AND ativo), (SELECT count(*) FROM agenda_servicos_excecoes WHERE agenda_id=tpl)));
        res := concat_ws(' # ', coalesce((r1 - 'agendamento_id' - 'id')::text,'-'), coalesce((r2 - 'agendamento_id' - 'id')::text,'-'), antes||'->'||depois,
          md5(coalesce((SELECT string_agg(concat_ws(',',slot_id,data,horario_inicio,horario_fim,status,credito_debitado,observacoes),';' ORDER BY slot_id)
                 FROM treino_agendamentos WHERE aluno_id=aluno AND created_at >= now()),'')
            || coalesce((SELECT string_agg(concat_ws(',',atividade,local,dia_semana,horario_inicio,horario_fim,tipo,data_especifica,profissional_id,observacoes),';')
                 FROM agenda_servicos WHERE aluno_id=aluno AND created_at >= now()),'')));
        RAISE EXCEPTION 'E5B_DESFAZ';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'E5B_DESFAZ' THEN res := 'ERRO: '||SQLERRM; END IF;
      END;
      out := out || jsonb_build_object(fase||':'||cen, res);
    END LOOP;
  END LOOP;
  SELECT string_agg(p.oid::regprocedure||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||p.proconfig::text||'|'||p.proacl::text||'|'||pg_get_function_result(p.oid), ' ; ' ORDER BY 1)
    INTO meta_d FROM pg_proc p WHERE p.oid IN ('fn_agendar_treino(uuid,date)'::regprocedure,'fn_agendar_servico(uuid,date)'::regprocedure);
  out := out || jsonb_build_object('meta_identica', meta_a = meta_d, 'meta', meta_d,
    'md5_treino', (SELECT md5(pg_get_functiondef('fn_agendar_treino(uuid,date)'::regprocedure))), 'md5_servico', (SELECT md5(pg_get_functiondef('fn_agendar_servico(uuid,date)'::regprocedure))),
    'guard_presente', (SELECT bool_and(prosrc LIKE '%somente_online%') FROM pg_proc WHERE oid IN ('fn_agendar_treino(uuid,date)'::regprocedure,'fn_agendar_servico(uuid,date)'::regprocedure)));
  RAISE EXCEPTION 'E5B_RESULTADO %', out;
END $ens$;
