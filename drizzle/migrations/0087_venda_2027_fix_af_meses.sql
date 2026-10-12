DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.fn_venda_2027_criar(jsonb)'::regprocedure) INTO src;
  IF position('jsonb_array_elements_text(COALESCE(c.avaliacoes_funcionais_meses, ''[]''::jsonb))::int' IN src) = 0 THEN
    RAISE EXCEPTION 'trecho não encontrado';
  END IF;
  src := replace(src,
    'jsonb_array_elements_text(COALESCE(c.avaliacoes_funcionais_meses, ''[]''::jsonb))::int',
    'unnest(COALESCE(c.avaliacoes_funcionais_meses, ''{}''::int[]))');
  EXECUTE src;
END
$do$;