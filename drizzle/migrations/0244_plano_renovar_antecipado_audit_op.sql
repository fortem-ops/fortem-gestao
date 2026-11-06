DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.fn_plano_renovar_antecipado(uuid)'::regprocedure) INTO src;
  src := replace(src, '''RENOVACAO_ANTECIPADA'', ''planos''', '''UPDATE'', ''planos''');
  src := replace(src, 'jsonb_build_object(''plano_anterior''', 'jsonb_build_object(''acao'', ''renovacao_antecipada'', ''plano_anterior''');
  EXECUTE src;
END $do$;