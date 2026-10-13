DO $mig$
DECLARE s text := pg_get_functiondef('public.fn_proposta_plano_2027_criar(jsonb)'::regprocedure);
  a text := $a$plano_interesse = coalesce(v_item.nome_exibicao, v_item.nome) || ' ' || v_item.frequencia::text,$a$;
  b text := $b$E'\nProposta do site /planos em '$b$;
BEGIN
  IF position(a in s) = 0 OR position(b in s) = 0 THEN RAISE EXCEPTION 'trecho não encontrado'; END IF;
  s := replace(s, a, $n$plano_interesse = CASE WHEN coalesce(v_item.nome_exibicao, v_item.nome) IN ('Start','Start+','Power','Pro','Max') THEN coalesce(v_item.nome_exibicao, v_item.nome) END,$n$);
  s := replace(s, b, $n$E'\nProposta do site /planos (' || coalesce(v_item.nome_exibicao, v_item.nome) || ' ' || v_item.frequencia::text || ') em '$n$);
  EXECUTE s;
END $mig$;