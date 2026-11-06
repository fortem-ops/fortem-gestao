DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.fn_plano_renovar_antecipado(uuid)'::regprocedure) INTO src;
  src := replace(src, '''UPDATE'', ''planos''', '''update'', ''planos''');
  EXECUTE src;
END $do$;