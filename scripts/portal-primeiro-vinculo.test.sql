-- Regression against the real trigger/RPC. Every fixture and side effect is rolled back.
-- Never depends on real student accounts or fixed auth UUIDs.
BEGIN;
DO $test$
DECLARE
  uid uuid := gen_random_uuid();
  other_uid uuid := gen_random_uuid();
  staff_uid uuid;
  email_teste text := 'fixture.vinculo.' || replace(uid::text, '-', '') || '@invalid.test';
  other_email text := 'fixture.outro.' || replace(other_uid::text, '-', '') || '@invalid.test';
  aluno uuid;
  result jsonb;
  blocked boolean;
  assignment text;
  avisos_antes integer;
  avisos_depois integer;
  total integer := 0;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email_teste, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    (other_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', other_email, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  SELECT r.user_id INTO STRICT staff_uid FROM public.user_roles r
    WHERE r.role IN ('admin', 'coordenador') AND public.is_staff(r.user_id) LIMIT 1;
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO public.alunos (nome, email, is_equipe)
    VALUES ('REGRESSAO VINCULO ROLLBACK', email_teste, true) RETURNING id INTO aluno;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  result := public.fn_portal_link_aluno();
  IF result->>'linked' IS DISTINCT FROM 'true' OR result->>'aluno_id' IS DISTINCT FROM aluno::text
    OR NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = aluno AND user_id = uid) THEN
    RAISE EXCEPTION 'REGRESSION: first link failed: %', result;
  END IF;
  total := total + 1;
  result := public.fn_portal_link_aluno();
  IF result->>'already' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Already linked contract changed'; END IF;
  total := total + 1;

  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.alunos SET user_id = NULL, email = '  ' || upper(email_teste) || '  ' WHERE id = aluno;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  UPDATE public.alunos SET user_id = uid WHERE id = aluno;
  total := total + 1;

  FOREACH assignment IN ARRAY ARRAY[
    'user_id = ' || quote_literal(other_uid),
    'user_id = NULL',
    'status = ''inativo''',
    'responsavel_id = ' || quote_literal(staff_uid),
    'current_pipeline_stage_id = gen_random_uuid()',
    'frequencia_semanal = 1',
    'cpf_hash = ''regression''',
    'cpf_encrypted = decode(''ab'', ''hex'')',
    'cpf_ultimos3 = ''123'''
  ] LOOP
    blocked := false;
    BEGIN
      EXECUTE 'UPDATE public.alunos SET ' || assignment || ' WHERE id = $1' USING aluno;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Alunos não podem alterar campos sensíveis do próprio cadastro' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'Sensitive update allowed: %', assignment; END IF;
    total := total + 1;
  END LOOP;

  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.alunos SET user_id = NULL, email = email_teste WHERE id = aluno;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  FOREACH assignment IN ARRAY ARRAY[
    'user_id = ' || quote_literal(uid) || ', status = ''inativo''',
    'user_id = ' || quote_literal(uid) || ', cpf_hash = ''regression''',
    'user_id = ' || quote_literal(other_uid)
  ] LOOP
    blocked := false;
    BEGIN
      EXECUTE 'UPDATE public.alunos SET ' || assignment || ' WHERE id = $1' USING aluno;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Alunos não podem alterar campos sensíveis do próprio cadastro' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'Invalid first link allowed: %', assignment; END IF;
    total := total + 1;
  END LOOP;

  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.alunos SET email = 'different@invalid.test' WHERE id = aluno;
  SELECT count(*) INTO avisos_antes FROM public.notificacoes WHERE created_at >= transaction_timestamp();
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  result := public.fn_portal_link_aluno();
  IF result->>'reason' IS DISTINCT FROM 'no_match' THEN RAISE EXCEPTION 'Different email linked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.system_logs WHERE modulo = 'portal-link-aluno' AND acao = 'no_match' AND user_id = uid AND created_at >= transaction_timestamp()) THEN
    RAISE EXCEPTION 'no_match was not logged';
  END IF;
  SELECT count(*) INTO avisos_depois FROM public.notificacoes WHERE created_at >= transaction_timestamp();
  IF avisos_depois <> avisos_antes + 1 THEN RAISE EXCEPTION 'Expected 1 admin notice on no_match'; END IF;
  -- Segunda chamada no mesmo dia não gera segundo aviso (máx 1/dia)
  result := public.fn_portal_link_aluno();
  IF (SELECT count(*) FROM public.notificacoes WHERE created_at >= transaction_timestamp()) <> avisos_depois THEN
    RAISE EXCEPTION 'Admin notice rate limit (1/day) violated';
  END IF;
  blocked := false;
  BEGIN
    UPDATE public.alunos SET user_id = uid WHERE id = aluno;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Different email direct update allowed'; END IF;
  total := total + 1;

  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.alunos SET user_id = other_uid, email = email_teste WHERE id = aluno;
  DELETE FROM public.system_logs WHERE modulo = 'portal-link-aluno' AND acao = 'aviso_admin_enviado' AND user_id = uid;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  result := public.fn_portal_link_aluno();
  IF result->>'reason' IS DISTINCT FROM 'ja_vinculado_outra_conta' THEN RAISE EXCEPTION 'Occupied account should return ja_vinculado_outra_conta, got %', result; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notificacoes WHERE aluno_id = aluno AND created_at >= transaction_timestamp()) THEN
    RAISE EXCEPTION 'Expected admin notice on ja_vinculado_outra_conta';
  END IF;
  total := total + 1;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', staff_uid, 'role', 'authenticated')::text, true);
  UPDATE public.alunos SET user_id = NULL, cpf_hash = 'staff-regression' WHERE id = aluno;
  IF NOT EXISTS (SELECT 1 FROM public.alunos WHERE id = aluno AND user_id IS NULL AND cpf_hash = 'staff-regression') THEN
    RAISE EXCEPTION 'Staff update failed';
  END IF;
  total := total + 1;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.alunos SET cpf_hash = 'service-regression' WHERE id = aluno;
  total := total + 1;

  -- Duplicate matches force UPDATE RETURNING to throw; the RPC must roll back and log it.
  INSERT INTO public.alunos (nome, email, is_equipe) VALUES ('REGRESSAO ERRO ROLLBACK', email_teste, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  result := public.fn_portal_link_aluno();
  IF result->>'linked' IS DISTINCT FROM 'false' OR result->>'reason' IS DISTINCT FROM 'erro_vinculo'
    OR coalesce(result->>'detalhe', '') = '' OR NOT EXISTS (
      SELECT 1 FROM public.system_logs WHERE modulo = 'portal-link-aluno' AND user_id = uid
        AND mensagem = result->>'detalhe' AND created_at >= transaction_timestamp()
    ) OR EXISTS (SELECT 1 FROM public.alunos WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Failed UPDATE was silent, unlogged or persisted: %', result;
  END IF;
  total := total + 1;
  IF total <> 20 THEN RAISE EXCEPTION 'Expected 20 checks, got %', total; END IF;
  RAISE NOTICE 'OK %/20 regression checks; fixtures rolled back', total;
END
$test$;
ROLLBACK;