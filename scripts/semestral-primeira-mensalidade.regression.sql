-- Plano Semestral, Etapa 4B: ensaio revertido (termina sempre em exceção => nada é gravado).
-- Respostas da Rede são simuladas (aprovada/recusada); nenhuma chamada externa é feita.
-- Saída esperada: "ENSAIO_OK: ..."; qualquer regra quebrada termina em "FALHOU: ...".
DO $t$
DECLARE
  v_aluno uuid := 'f0ddccf9-3e24-485b-bfc9-5e7bf1c62fa9';  -- aluna Wellhub real ativa
  v_admin uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  v_coord uuid := '8a7a77b8-8a6d-4aa1-9e55-76ff8b5e79e0';
  v_venda uuid; v_cat uuid; r jsonb; r2 jsonb; res jsonb; k public.contratos; n int; v_cs uuid; v_well uuid; v_res text := '';
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_ok boolean;
BEGIN
  UPDATE public.planos_catalogo SET ativo = true WHERE familia = 'semestral_2027';
  UPDATE public.contrato_templates SET ativo = true WHERE plano_tipo IN ('semestral_wellhub','semestral_totalpass');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SELECT id INTO v_well FROM public.planos WHERE aluno_id = v_aluno AND ativo AND tipo = 'Gympass/Wellhub' LIMIT 1;
  SELECT id INTO v_cat FROM public.planos_catalogo WHERE codigo = 'pro_semestral_wellhub_3x';

  -- 1) Venda registrada => aguardando pagamento: nada ativo e Wellhub intacto.
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-4b'));
  v_venda := (r->>'venda_id')::uuid;
  SELECT * INTO k FROM public.contratos WHERE id = (r->>'contrato_id')::uuid;
  IF (r->>'valor_centavos')::int <> 46900 THEN RAISE EXCEPTION 'FALHOU: valor da nº1 %', r->>'valor_centavos'; END IF;
  IF (SELECT ativo FROM public.planos WHERE id = k.plano_id) THEN RAISE EXCEPTION 'FALHOU: Semestral ativo antes de pagar'; END IF;
  IF NOT (SELECT ativo FROM public.planos WHERE id = v_well) THEN RAISE EXCEPTION 'FALHOU: Wellhub encerrado antes de pagar'; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE aluno_id = v_aluno AND origem_id IN (v_venda, k.plano_id) AND ativo;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: % créditos ativos antes de pagar', n; END IF;
  v_res := v_res || '1 venda aguardando: plano inativo, 0 créditos, Wellhub ativo; ';

  -- Cartão salvo de ensaio (tokenização fictícia, nunca enviada).
  INSERT INTO public.cartoes_salvos (aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year)
  VALUES (v_aluno, 'ENSAIO', 'visa', '0000', 'ENSAIO TITULAR', 12, 2030) RETURNING id INTO v_cs;
  INSERT INTO public.rede_tokenizacoes (tokenization_id, aluno_id, cartao_salvo_id, status, origem)
  VALUES ('ENSAIO-4B', v_aluno, v_cs, 'active', 'recepcao');
  PERFORM public.fn_semestral_definir_cartao(v_venda, v_cs);

  -- 2) Recusa simulada: reserva, Rede responde "recusado" => pagamento negado, nada ativado.
  res := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-t1', 'token', v_cs, NULL);
  IF NOT (res->>'nova')::boolean OR (res->>'valor_centavos')::int <> 46900 THEN RAISE EXCEPTION 'FALHOU: reserva 1 %', res; END IF;
  UPDATE public.pagamentos_rede SET status = 'denied', return_code = '05', return_message = 'Não autorizada' WHERE id = (res->>'pagamento_id')::uuid;
  IF (SELECT ativo FROM public.planos WHERE id = k.plano_id) OR NOT (SELECT ativo FROM public.planos WHERE id = v_well) THEN
    RAISE EXCEPTION 'FALHOU: recusa ativou o Semestral ou encerrou o Wellhub'; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE aluno_id = v_aluno AND origem_id IN (v_venda, k.plano_id) AND ativo;
  IF n <> 0 OR (SELECT status FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1) <> 'pendente' THEN
    RAISE EXCEPTION 'FALHOU: recusa liberou créditos ou baixou a nº1'; END IF;
  -- Reabrir a venda depois da recusa retoma a mesma (não cria outra).
  r2 := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-4b-2'));
  IF (r2->>'venda_id')::uuid <> v_venda OR NOT (r2->>'retomada')::boolean THEN RAISE EXCEPTION 'FALHOU: não retomou a venda'; END IF;
  v_res := v_res || '2 recusa: nada ativo, Wellhub ativo, nº1 pendente, reabrir retoma a mesma venda; ';

  -- 3) Nova tentativa + clique repetido: uma só reserva pendente, sem segunda cobrança.
  res := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-t2', 'token', v_cs, NULL);
  r2 := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-t2b', 'token', v_cs, NULL);
  IF NOT (res->>'nova')::boolean OR COALESCE((r2->>'nova')::boolean, false) OR NOT (r2->>'em_processamento')::boolean
     OR r2->>'pagamento_id' <> res->>'pagamento_id' THEN RAISE EXCEPTION 'FALHOU: clique repetido % / %', res, r2; END IF;
  SELECT count(*) INTO n FROM public.pagamentos_rede WHERE venda_id = v_venda AND status IN ('pending','approved');
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: % pagamentos abertos', n; END IF;
  BEGIN
    PERFORM public.fn_semestral_definir_cartao(v_venda, v_cs); v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: trocou cartão com pagamento em processamento'; END IF;
  v_res := v_res || '3 clique repetido: 1 reserva, sem 2ª cobrança, troca de cartão bloqueada; ';

  -- 4) Aprovação simulada => nº1 paga, 12 Treinos + 4 Bota + 1ª Avaliação, plano ativo, Wellhub encerrado, nº2 uma vez.
  r2 := public.fn_manual_primeiro_ciclo_liquidar(v_venda, (res->>'pagamento_id')::uuid,
    jsonb_build_object('tid', 'ENSAIO-TID-4B', 'nsu', '1', 'authorization_code', 'A1', 'return_code', '00', 'return_message', 'Sucesso'));
  IF NOT (r2->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: liquidar %', r2; END IF;
  IF (SELECT status FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1) <> 'pago'
     OR (SELECT status_pagamento::text FROM public.vendas WHERE id = v_venda) <> 'pago' THEN RAISE EXCEPTION 'FALHOU: nº1/venda não pagas'; END IF;
  IF NOT (SELECT ativo FROM public.planos WHERE id = k.plano_id) THEN RAISE EXCEPTION 'FALHOU: Semestral não ativado'; END IF;
  IF (SELECT ativo FROM public.planos WHERE id = v_well) OR (SELECT data_fim FROM public.planos WHERE id = v_well) <> v_hoje THEN
    RAISE EXCEPTION 'FALHOU: Wellhub não encerrado hoje'; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = v_venda AND atividade = 'Treino' AND ativo AND quantidade_inicial = 12;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: Treino %', n; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = v_venda AND atividade = 'Recovery (Bota de Compressão)' AND ativo AND quantidade_inicial = 4;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: Bota %', n; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE aluno_id = v_aluno AND origem_id IN (v_venda, k.plano_id) AND atividade ILIKE 'Avalia%' AND ativo;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: Avaliação %', n; END IF;
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades WHERE venda_origem_id = v_venda AND numero = 2 AND valor_centavos = 46900;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: nº2 %', n; END IF;
  SELECT count(*) INTO n FROM public.pagamentos_rede WHERE venda_id = v_venda AND status = 'approved';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: espelho pagamentos_rede %', n; END IF;
  v_res := v_res || '4 aprovada: nº1 e venda pagas, 12 Treinos + 4 Bota + 1 Avaliação, plano ativo, Wellhub encerrado em ' || v_hoje || ', nº2 R$469 1x, 1 pagamento aprovado; ';

  -- 5) Repetição (webhook/clique depois da aprovação) não cobra nem libera de novo.
  r2 := public.fn_manual_primeiro_ciclo_liquidar(v_venda, (res->>'pagamento_id')::uuid, NULL);
  r2 := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-t3', 'token', v_cs, NULL);
  IF COALESCE((r2->>'nova')::boolean, false) OR NOT (r2->>'idempotente')::boolean THEN RAISE EXCEPTION 'FALHOU: repetição %', r2; END IF;
  SELECT count(*) INTO n FROM public.pagamentos_rede WHERE venda_id = v_venda;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: % pagamentos (esperado 1 negado + 1 aprovado)', n; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = v_venda AND atividade = 'Treino';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: Treino duplicado'; END IF;
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades WHERE venda_origem_id = v_venda;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: nº2 duplicada'; END IF;
  v_res := v_res || '5 repetição: sem nova cobrança, sem crédito ou nº2 duplicados; ';

  -- 6) Cancelamento: coordenador é recusado no servidor; admin cancela sem multa.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.fn_semestral_cancelar(k.id, 'ensaio'); v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: coordenador cancelou'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  r2 := public.fn_semestral_cancelar(k.id, 'Mudança de cidade');
  IF (r2->>'multa')::int <> 0 OR (r2->>'mensalidades_canceladas')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: cancelamento %', r2; END IF;
  v_res := v_res || '6 cancelar: coordenador recusado, admin sem multa, 1 mensalidade futura cancelada, acesso até ' || (r2->>'acesso_ate');

  RAISE EXCEPTION 'ENSAIO_OK: %', v_res;
END $t$;
