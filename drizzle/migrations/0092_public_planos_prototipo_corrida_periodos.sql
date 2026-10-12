DO $migration$
DECLARE v text;
BEGIN
  v := pg_get_functiondef('public.fn_planos_publico_2027(boolean)'::regprocedure);
  IF position('p.periodo_meses = 1 AND p.nome IN' in v) = 0 THEN RAISE EXCEPTION 'Unexpected catalog function'; END IF;
  v := replace(v, '''nome'', p.nome, ''valor'', p.valor) ORDER BY p.nome', '''nome'', p.nome, ''valor'', p.valor, ''periodo_meses'', p.periodo_meses) ORDER BY p.nome, p.periodo_meses');
  v := replace(v, 'p.periodo_meses = 1 AND p.nome IN', 'p.periodo_meses IN (1, 6, 12) AND p.nome IN');
  EXECUTE v;
  v := pg_get_functiondef('public.fn_proposta_plano_2027_criar(jsonb)'::regprocedure);
  IF position('p2.periodo_meses = 1' in v) = 0 THEN RAISE EXCEPTION 'Unexpected proposal function'; END IF;
  v := replace(v, '  v_corrida_valor numeric;', E'  v_corrida_valor numeric;\n  v_corrida_periodo int := coalesce((p->>''corrida_periodo_meses'')::int, 1);\n  v_corrida_total numeric;');
  v := replace(v, E'  IF v_corrida THEN\n    SELECT p2.valor INTO v_corrida_valor', E'  IF v_corrida THEN\n    IF v_corrida_periodo NOT IN (1, 6, 12) THEN RAISE EXCEPTION ''Período da corrida inválido''; END IF;\n    SELECT p2.valor, p2.valor / p2.periodo_meses INTO v_corrida_total, v_corrida_valor');
  v := replace(v, 'p2.periodo_meses = 1', 'p2.periodo_meses = v_corrida_periodo');
  v := replace(v, E'    LIMIT 1;\n  END IF;', E'    LIMIT 1;\n    IF NOT FOUND THEN RAISE EXCEPTION ''Grupo de corrida indisponível''; END IF;\n  END IF;');
  v := replace(v, '''modalidade'', v_item.modalidade_cobranca), v_previa)', '''modalidade'', v_item.modalidade_cobranca, ''corrida_periodo_meses'', CASE WHEN v_corrida THEN v_corrida_periodo END, ''corrida_total_centavos'', CASE WHEN v_corrida THEN round(v_corrida_total * 100) END), v_previa)');
  v := replace(v, E'    v_forma_s := NULL; v_parc_s := NULL;\n  END IF;\n  v_total_c', E'    IF v_forma = ''pix_vista'' AND v_serv_n > 0 THEN\n      IF v_forma_s NOT IN (''cartao_parcelado'', ''pix_vista'') THEN RAISE EXCEPTION ''Forma dos serviços inválida''; END IF;\n      IF v_forma_s = ''pix_vista'' THEN v_parc_s := 1; END IF;\n      IF v_parc_s < 1 OR v_parc_s > 6 THEN RAISE EXCEPTION ''Serviços em até 6x''; END IF;\n    ELSE v_forma_s := NULL; v_parc_s := NULL; END IF;\n  END IF;\n  v_total_c');
  EXECUTE v;
END;
$migration$;