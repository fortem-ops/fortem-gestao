-- Plano Semestral: link de pagamento da 1ª mensalidade. Ensaio revertido (termina sempre em exceção => nada é gravado).
-- Rede simulada (reserva + liquidação), nenhuma chamada externa. Saída esperada: "ENSAIO_OK: ...".
DO $t$
DECLARE
  v_well_aluno uuid := '176bcc9d-7705-43e3-977f-2ab19cd00a4c';  -- aluna Wellhub real
  v_tp_aluno uuid := '9dfdd930-e309-48a7-a8c4-016e2fd3c209';    -- aluno TotalPass real
  v_coord uuid := '8a7a77b8-8a6d-4aa1-9e55-76ff8b5e79e0';
  r jsonb; l1 jsonb; l2 jsonb; res jsonb; k public.contratos; v_venda uuid; v_cs uuid; v_agr uuid; n int; v_ok boolean; v_res text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);

  -- A) Wellhub + Pro Semestral: link 72 h, reaproveitado, pagamento pelo caminho do link ativa tudo.
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_well_aluno,
        'catalogo_id', (SELECT id FROM planos_catalogo WHERE codigo='pro_semestral_wellhub_3x'), 'idempotency_key', 'ensaio-link-a'));
  v_venda := (r->>'venda_id')::uuid; SELECT * INTO k FROM contratos WHERE id = (r->>'contrato_id')::uuid;
  l1 := public.fn_semestral_link_criar(v_venda);
  IF abs(extract(epoch FROM ((l1->>'expira_em')::timestamptz - (now() + interval '72 hours')))) > 5 THEN RAISE EXCEPTION 'FALHOU: validade %', l1->>'expira_em'; END IF;
  IF l1->>'plano' <> 'Pro Semestral' OR (l1->>'valor')::numeric <> 469 OR position(' ' IN l1->>'primeiro_nome') > 0 THEN RAISE EXCEPTION 'FALHOU: dados do link %', l1 - 'token'; END IF;
  l2 := public.fn_semestral_link_criar(v_venda);
  IF l2->>'token' <> l1->>'token' THEN RAISE EXCEPTION 'FALHOU: não reaproveitou o link'; END IF;
  IF length(l1->>'token') <> 64 THEN RAISE EXCEPTION 'FALHOU: token curto'; END IF;
  v_res := v_res || 'A1 Wellhub Pro: link 72h R$469, mesmo link no 2º clique; ';

  -- Sem login não gera link.
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.fn_semestral_link_criar(v_venda); v_ok := true; EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: link gerado sem permissão'; END IF;

  -- Caminho do servidor no link (service role): elegibilidade de novo, cartão do aluno, reserva e baixa simuladas.
  r := public.fn_semestral_elegivel(v_well_aluno, 'pro_semestral_wellhub_3x', NULL, false);
  IF NOT (r->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHOU: rechecagem recusou aluna elegível %', r; END IF;
  INSERT INTO cartoes_salvos (aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, origem)
  VALUES (v_well_aluno, 'ENSAIO', 'visa', '0000', 'ENSAIO TITULAR', 12, 2030, 'link_cadastro') RETURNING id INTO v_cs;
  INSERT INTO rede_tokenizacoes (tokenization_id, aluno_id, cartao_salvo_id, status, origem) VALUES ('ENSAIO-LINK', v_well_aluno, v_cs, 'active', 'link_cadastro');
  PERFORM public.fn_semestral_definir_cartao_core(v_venda, v_cs);
  res := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-link-1', 'token', v_cs, NULL);
  UPDATE pagamentos_rede SET status = 'denied', return_code = '05' WHERE id = (res->>'pagamento_id')::uuid;   -- recusa
  IF (SELECT ativo FROM planos WHERE id = k.plano_id) THEN RAISE EXCEPTION 'FALHOU: recusa ativou'; END IF;
  res := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-link-2', 'token', v_cs, NULL);              -- outro cartão/tentativa
  r := public.fn_manual_primeiro_ciclo_reservar(v_venda, 'ensaio-link-2b', 'token', v_cs, NULL);                -- clique repetido
  IF r->>'pagamento_id' <> res->>'pagamento_id' THEN RAISE EXCEPTION 'FALHOU: segunda reserva'; END IF;
  r := public.fn_manual_primeiro_ciclo_liquidar(v_venda, (res->>'pagamento_id')::uuid,
        jsonb_build_object('tid','ENSAIO-LINK','nsu','1','authorization_code','A1','return_code','00','return_message','Sucesso'));
  UPDATE links_pagamento SET usado_em = now() WHERE venda_id = v_venda AND usado_em IS NULL;                   -- o que a função do link faz
  IF NOT (SELECT ativo FROM planos WHERE id = k.plano_id) THEN RAISE EXCEPTION 'FALHOU: não ativou'; END IF;
  IF EXISTS (SELECT 1 FROM planos WHERE aluno_id = v_well_aluno AND ativo AND tipo = 'Gympass/Wellhub') THEN RAISE EXCEPTION 'FALHOU: Wellhub ativo após pagar'; END IF;
  SELECT count(*) INTO n FROM creditos_aluno WHERE origem_id = v_venda AND ativo AND ((atividade='Treino' AND quantidade_inicial=12) OR (atividade ILIKE 'Recovery%' AND quantidade_inicial=4));
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: créditos %', n; END IF;
  SELECT count(*) INTO n FROM planos_2027_mensalidades WHERE venda_origem_id = v_venda AND numero = 2;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: nº2 %', n; END IF;
  SELECT count(*) INTO n FROM pagamentos_rede WHERE venda_id = v_venda AND status = 'approved';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: % aprovados', n; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.fn_semestral_link_criar(v_venda); v_ok := true; EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: novo link depois de pago'; END IF;
  v_res := v_res || 'A2 recusa não ativa, nova tentativa e clique repetido = 1 reserva, aprovação ativa (12 Treino, 4 Bota, nº2 uma vez), Wellhub encerrado, sem link novo depois de pago; ';

  -- B) TotalPass + Start Semestral: rechecagem recusa quem perdeu a agregadora; desistência invalida o link.
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_tp_aluno,
        'catalogo_id', (SELECT id FROM planos_catalogo WHERE codigo='start_semestral_totalpass_3x'), 'idempotency_key', 'ensaio-link-b'));
  v_venda := (r->>'venda_id')::uuid;
  l1 := public.fn_semestral_link_criar(v_venda);
  IF l1->>'plano' <> 'Start Semestral' OR (l1->>'valor')::numeric <> 409 THEN RAISE EXCEPTION 'FALHOU: dados TotalPass %', l1 - 'token'; END IF;
  SELECT id INTO v_agr FROM planos WHERE aluno_id = v_tp_aluno AND ativo AND tipo = 'Total Pass' LIMIT 1;
  UPDATE planos SET ativo = false WHERE id = v_agr;
  PERFORM set_config('request.jwt.claims', '', true);
  r := public.fn_semestral_elegivel(v_tp_aluno, 'start_semestral_totalpass_3x', NULL, false);
  IF (r->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHOU: rechecagem aceitou aluno sem TotalPass'; END IF;
  UPDATE planos SET ativo = true WHERE id = v_agr;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
  PERFORM public.fn_semestral_desistir(v_venda, 'ensaio');
  IF EXISTS (SELECT 1 FROM links_pagamento WHERE venda_id = v_venda AND expira_em > now()) THEN RAISE EXCEPTION 'FALHOU: link vivo após desistência'; END IF;
  IF NOT EXISTS (SELECT 1 FROM planos WHERE id = v_agr AND ativo) THEN RAISE EXCEPTION 'FALHOU: TotalPass encerrado'; END IF;
  v_res := v_res || 'B TotalPass Start: link R$409, rechecagem recusa sem agregadora, desistência mata o link, TotalPass ativo; ';

  -- C) Validade nunca passa da expiração da venda.
  IF public.fn_semestral_link_validade(now(), now() - interval '6 days') >= now() + interval '72 hours' THEN RAISE EXCEPTION 'FALHOU: validade passou da venda'; END IF;
  v_res := v_res || 'C venda de 6 dias: link vence antes de 72h; ';

  RAISE EXCEPTION 'ENSAIO_OK: %', v_res;
END $t$;
