DO $m$
DECLARE d text := pg_get_functiondef('public.fn_proposta_plano_2027_criar(jsonb)'::regprocedure);
  a text := E'BEGIN\n  IF v_previa AND NOT';
BEGIN
  IF position('Consultas são contratadas com a equipe' in d) > 0 THEN RETURN; END IF;
  IF position(a in d) = 0 THEN RAISE EXCEPTION 'ponto de inserção não encontrado'; END IF;
  d := replace(d, a, E'BEGIN\n  -- Site vende só o plano: consultas são fechadas com a equipe e lançadas no balcão.\n  IF cardinality(v_serv) > 0 THEN RAISE EXCEPTION ''Consultas são contratadas com a equipe''; END IF;\n  IF v_previa AND NOT');
  EXECUTE d;
END $m$;