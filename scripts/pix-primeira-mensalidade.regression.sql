-- Ensaio revertido do Pix da 1ª mensalidade (grupo do Enio). Termina SEMPRE com exceção: nada persiste.
DO $$
DECLARE g uuid := 'e51dd61d-45f0-42b2-b90b-c9159952ffb1'; r jsonb; r2 jsonb; v_id uuid; v_ok text := '';
  v_cob uuid := '84f12adc-e41f-469b-98fc-47885ad0f229'; v_vs uuid := 'b5979261-ae8f-4ff5-acf5-7ab6ba12484f'; v_vc uuid := '2a50faab-1684-4700-8a91-876604bbe8f8';
  v_prox_antes date; v_ciclos int; v_grp text; v_erro text; v_st text; v_n int;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_prox_antes := public.fn_pix_aut_proximo_venc(g);
  SELECT count(*) INTO v_ciclos FROM pix_aut_ciclos WHERE grupo_id = g;
  SELECT row(status, valor_teto, dia_debito, recorrencia_id)::text INTO v_grp FROM pix_aut_grupos WHERE id = g;
  -- nada pago antes
  IF EXISTS (SELECT 1 FROM cobrancas WHERE id = v_cob AND status <> 'pendente') OR EXISTS (SELECT 1 FROM vendas WHERE id IN (v_vs, v_vc) AND status_pagamento <> 'pendente') THEN RAISE EXCEPTION 'FALHA linhas já pagas'; END IF;

  r := public.fn_pix_aut_primeira_reservar(g, 'ENSAIOtx0000000000000000000001', NULL);
  IF r->>'acao' <> 'nova' OR (r->>'valor')::numeric <> 320 OR jsonb_array_length(r->'composicao'->'itens') <> 2 THEN RAISE EXCEPTION 'FALHA composicao %', r; END IF;
  v_id := (r->>'id')::uuid; v_ok := v_ok || '1 composicao 320/2 itens; ';
  PERFORM public.fn_pix_aut_primeira_ativar(v_id, 'COPIAENSAIO', now() + interval '2 days', '{}');
  r2 := public.fn_pix_aut_primeira_reservar(g, 'ENSAIOtx0000000000000000000002', NULL);
  IF r2->>'acao' <> 'reaproveitada' OR r2->>'txid' <> 'ENSAIOtx0000000000000000000001' OR r2->>'pix_copia_cola' <> 'COPIAENSAIO' THEN RAISE EXCEPTION 'FALHA idempotencia %', r2; END IF;
  SELECT count(*) INTO v_n FROM pix_aut_imediatas WHERE grupo_id = g; IF v_n <> 1 THEN RAISE EXCEPTION 'FALHA duplicou'; END IF;
  v_ok := v_ok || '2 mesmo QR; ';
  IF NOT (public.fn_pix_aut_venda_reservada(v_vs) AND public.fn_pix_aut_venda_reservada(v_vc)) THEN RAISE EXCEPTION 'FALHA reserva venda'; END IF;
  v_ok := v_ok || '3 cartao/link bloqueados (venda_reservada); ';
  -- baixa manual por usuário comum (admin, sem liberar) é recusada
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', 'a95eaac6-da86-45a2-a877-0e10316d6e64', 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE cobrancas SET status = 'pago' WHERE id = v_cob;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_erro := 'sem_erro rows=' || v_n;
  EXCEPTION WHEN others THEN v_erro := SQLERRM; END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  IF v_erro <> 'reservado_pix_automatico' THEN RAISE EXCEPTION 'FALHA baixa manual: %', v_erro; END IF;
  v_ok := v_ok || '4 baixa manual bloqueada; ';
  -- valor divergente: não baixa (ensaio em sub-bloco desfeito)
  BEGIN
    r2 := public.fn_pix_aut_primeira_evento('ENSAIOtx0000000000000000000001', 300, 'E2EDIV', now());
    SELECT status INTO v_st FROM cobrancas WHERE id = v_cob;
    RAISE EXCEPTION 'desfaz';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'desfaz' THEN RAISE; END IF; END;
  IF r2->>'acao' <> 'divergente' OR v_st <> 'pendente' THEN RAISE EXCEPTION 'FALHA divergente % %', r2, v_st; END IF;
  v_ok := v_ok || '5 divergente sem baixa; ';
  -- expiração libera reserva (sub-bloco desfeito)
  BEGIN
    UPDATE pix_aut_imediatas SET expira_em = now() - interval '1 hour' WHERE id = v_id;
    r2 := public.fn_pix_aut_primeira_expirar();
    SELECT status INTO v_st FROM pix_aut_imediatas WHERE id = v_id;
    v_erro := (public.fn_pix_aut_venda_reservada(v_vs) OR public.fn_pix_aut_venda_reservada(v_vc) OR EXISTS (SELECT 1 FROM cobrancas WHERE id = v_cob AND pix_aut_grupo_id IS NOT NULL))::text;
    RAISE EXCEPTION 'desfaz';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'desfaz' THEN RAISE; END IF; END;
  IF (r2->>'expiradas')::int <> 1 OR v_st <> 'expirada' OR v_erro <> 'false' THEN RAISE EXCEPTION 'FALHA expirar % % %', r2, v_st, v_erro; END IF;
  v_ok := v_ok || '6 expirado libera; ';
  -- baixa correta, repetida
  r2 := public.fn_pix_aut_primeira_evento('ENSAIOtx0000000000000000000001', 320, 'E2EOK', '2026-11-11T13:00:00Z');
  IF r2->>'acao' <> 'liquidada' THEN RAISE EXCEPTION 'FALHA baixa %', r2; END IF;
  r2 := public.fn_pix_aut_primeira_evento('ENSAIOtx0000000000000000000001', 320, 'E2EOK', '2026-11-11T13:00:00Z');
  IF r2->>'acao' <> 'repetido' THEN RAISE EXCEPTION 'FALHA repetido %', r2; END IF;
  IF NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = v_cob AND status = 'pago' AND forma_pagamento = 'pix' AND data_pagamento = '2026-11-11')
     OR (SELECT count(*) FROM vendas WHERE id IN (v_vs, v_vc) AND status_pagamento = 'pago' AND forma_pagamento = 'pix') <> 2 THEN RAISE EXCEPTION 'FALHA linhas baixadas'; END IF;
  v_ok := v_ok || '7 baixa dividida 1x (Start cobranca+venda, Corrida); ';
  -- débito automático de 12/12 intacto
  IF public.fn_pix_aut_proximo_venc(g) IS DISTINCT FROM v_prox_antes OR (SELECT count(*) FROM pix_aut_ciclos WHERE grupo_id = g) <> v_ciclos
     OR (SELECT row(status, valor_teto, dia_debito, recorrencia_id)::text FROM pix_aut_grupos WHERE id = g) <> v_grp THEN RAISE EXCEPTION 'FALHA 12/12 alterado'; END IF;
  v_ok := v_ok || '8 12/12 intacto (prox=' || coalesce(v_prox_antes::text, 'null') || ')';
  RAISE EXCEPTION 'ENSAIO_OK: %', v_ok;
END $$;
