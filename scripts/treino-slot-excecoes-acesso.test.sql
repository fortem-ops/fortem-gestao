-- All student/schedule fixtures and role side effects are rolled back.
-- Existing login identities are only referenced, never modified directly.
BEGIN;
DO $test$
DECLARE
  linked_uid uuid;
  staff_uid uuid;
  unrelated_uid uuid := gen_random_uuid();
  student_id uuid := gen_random_uuid();
  slot_id uuid := gen_random_uuid();
  exception_id uuid := gen_random_uuid();
  total integer;
BEGIN
  SELECT u.id INTO STRICT linked_uid FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.alunos a WHERE a.user_id=u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta'))
  LIMIT 1;
  SELECT r.user_id INTO STRICT staff_uid FROM public.user_roles r WHERE r.role='professor' LIMIT 1;
  INSERT INTO public.alunos(id,nome,status,user_id,is_equipe)
    VALUES(student_id,'Fixture acesso exceções','ativo',linked_uid,false);
  INSERT INTO public.treino_slots(id,dia_semana,horario_inicio,horario_fim,created_by)
    VALUES(slot_id,1,'03:17:29','04:17:29',staff_uid);
  INSERT INTO public.treino_slot_excecoes(id,slot_id,data,horario_inicio,horario_fim,capacidade_maxima,created_by)
    VALUES(exception_id,slot_id,'2099-01-05','10:30','11:30',8,staff_uid);

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',unrelated_uid,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO total FROM public.treino_slot_excecoes WHERE id=exception_id;
  IF total<>0 THEN RAISE EXCEPTION 'Unrelated account read exception'; END IF;
  UPDATE public.treino_slot_excecoes SET capacidade_maxima=99 WHERE id=exception_id;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>0 THEN RAISE EXCEPTION 'Unrelated account changed exception'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',linked_uid,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO total FROM public.treino_slot_excecoes WHERE id=exception_id AND horario_inicio='10:30';
  IF total<>1 THEN RAISE EXCEPTION 'Linked student cannot see shared schedule change'; END IF;
  UPDATE public.treino_slot_excecoes SET capacidade_maxima=99 WHERE id=exception_id;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>0 THEN RAISE EXCEPTION 'Student changed exception'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',staff_uid,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO total FROM public.treino_slot_excecoes WHERE id=exception_id;
  IF total<>1 THEN RAISE EXCEPTION 'Staff cannot read exception'; END IF;
  UPDATE public.treino_slot_excecoes SET capacidade_maxima=10 WHERE id=exception_id;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total<>1 THEN RAISE EXCEPTION 'Staff cannot change exception'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims','{}',true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO total FROM public.treino_slot_excecoes WHERE id=exception_id;
    IF total<>0 THEN RAISE EXCEPTION 'Visitor read exception'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END;
$test$;
ROLLBACK;