-- E5b-B ENSAIO — NÃO EXECUTADO. Transação desfeita (termina em RAISE EXCEPTION). NICOLAS TESTE.
-- Executa como papel authenticated (passa por RLS) com login de aluno emprestado, antes e depois da troca de policies.
-- Casos: presencial (Start) — INSERT direto, UPDATE confirmado, UPDATE realizado, SELECT, DELETE: tudo igual antes×depois.
--        só Consultoria — INSERT direto: antes aceito, depois recusado; UPDATE/SELECT de linha criada pela equipe: igual.
--        equipe (is_staff) — INSERT para aluno só Consultoria: aceito antes e depois.
DO $b$
DECLARE
  aluno constant uuid := '085acf57-2dbe-464d-9acc-e1b0f5b77032';
  staff constant uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  slot  constant uuid := 'ce3a980f-9b45-4da6-bb41-527991f063a9';
  uid uuid; fase text; cen text; res text; n int; out jsonb := '{}'; rid uuid;
  cats jsonb := jsonb_build_object('start','c7292e78-e758-4088-a073-059e15f2910d','consultoria','c958faf4-f3ba-4b8f-960a-019b4c31aa38');
BEGIN
  SELECT u.id INTO uid FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role <> 'aluno')
     AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id=u.id AND pr.ativo=false)
   ORDER BY (SELECT count(*) FROM alunos a WHERE a.user_id=u.id), u.created_at LIMIT 1;
  FOREACH fase IN ARRAY ARRAY['antes','depois'] LOOP
    IF fase = 'depois' THEN
      EXECUTE $p$
DROP POLICY aluno_own_treino_agendamentos ON public.treino_agendamentos;
CREATE POLICY aluno_own_treino_agendamentos_select ON public.treino_agendamentos FOR SELECT TO public USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
CREATE POLICY aluno_own_treino_agendamentos_insert ON public.treino_agendamentos FOR INSERT TO public WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL) AND NOT public.fn_aluno_somente_online(aluno_id));
CREATE POLICY aluno_own_treino_agendamentos_update ON public.treino_agendamentos FOR UPDATE TO public USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL)) WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
CREATE POLICY aluno_own_treino_agendamentos_delete ON public.treino_agendamentos FOR DELETE TO public USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
$p$;
    END IF;
    FOREACH cen IN ARRAY ARRAY['start','consultoria','equipe_consultoria'] LOOP
      res := '';
      BEGIN
        UPDATE alunos SET user_id = NULL WHERE user_id = uid;
        UPDATE alunos SET user_id = uid WHERE id = aluno;
        UPDATE planos SET ativo = false WHERE aluno_id = aluno AND ativo;
        INSERT INTO planos (aluno_id, catalogo_id, tipo, atividade, ativo, data_inicio, data_fim)
        SELECT aluno, c.id, c.nome, c.atividade, true, current_date, current_date+30 FROM planos_catalogo c
         WHERE c.id = (cats->>(CASE cen WHEN 'start' THEN 'start' ELSE 'consultoria' END))::uuid;
        -- linha preexistente criada pela equipe (para testar UPDATE/SELECT do aluno)
        INSERT INTO treino_agendamentos (aluno_id, slot_id, data, horario_inicio, horario_fim, status, credito_debitado)
        VALUES (aluno, slot, '2026-11-02', '06:00', '07:00', 'agendado', false) RETURNING id INTO rid;
        PERFORM set_config('request.jwt.claims', json_build_object('sub', CASE WHEN cen='equipe_consultoria' THEN staff ELSE uid END,'role','authenticated')::text, true);
        SET LOCAL ROLE authenticated;
        BEGIN
          INSERT INTO treino_agendamentos (aluno_id, slot_id, data, horario_inicio, horario_fim, status, credito_debitado)
          VALUES (aluno, slot, '2026-11-09', '06:00', '07:00', 'agendado', false);
          res := res || 'insert=ok';
        EXCEPTION WHEN OTHERS THEN res := res || 'insert=recusado(' || SQLSTATE || ')'; END;
        UPDATE treino_agendamentos SET status='confirmado' WHERE id = rid; GET DIAGNOSTICS n = ROW_COUNT; res := res || ' upd_confirmado=' || n;
        UPDATE treino_agendamentos SET status='realizado'  WHERE id = rid; GET DIAGNOSTICS n = ROW_COUNT; res := res || ' upd_realizado=' || n;
        SELECT count(*) INTO n FROM treino_agendamentos WHERE aluno_id = aluno AND data >= '2026-11-01'; res := res || ' select=' || n;
        DELETE FROM treino_agendamentos WHERE id = rid; GET DIAGNOSTICS n = ROW_COUNT; res := res || ' delete=' || n;
        RESET ROLE;
        RAISE EXCEPTION 'E5BB_DESFAZ';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'E5BB_DESFAZ' THEN res := 'ERRO: ' || SQLERRM; END IF;
      END;
      out := out || jsonb_build_object(fase||':'||cen, res);
    END LOOP;
  END LOOP;
  RAISE EXCEPTION 'E5BB_RESULTADO %', out;
END $b$;
-- Esperado: start antes=depois (insert=ok, upd 1/1, select 2, delete 1); consultoria antes insert=ok, depois insert=recusado(42501), resto igual;
--           equipe_consultoria antes=depois insert=ok.
