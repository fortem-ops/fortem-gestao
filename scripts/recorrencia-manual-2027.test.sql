-- Ensaio NICOLAS TESTE: venda manual 2027 na recorrência automática. Rollback obrigatório; nenhuma chamada à Rede.
BEGIN;
DO $test$
DECLARE r jsonb; a jsonb; v uuid; k uuid; pl uuid; cb1 uuid; pr uuid; cs uuid; tk uuid; cs2 uuid; tk2 uuid;
  m2 planos_2027_mensalidades; m3 planos_2027_mensalidades; m4 planos_2027_mensalidades; x planos_2027_mensalidades;
  ren jsonb; k2 uuid; n int; s text; rp jsonb; vp uuid; kp uuid;
  aluno constant uuid := '085acf57-2dbe-464d-9acc-e1b0f5b77032';
BEGIN
 -- Cartão de teste (token fictício) do NICOLAS TESTE
 INSERT INTO cartoes_salvos(aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo)
 VALUES (aluno, 'TESTE-TOKEN', 'Mastercard', '0000', 'NICOLAS TESTE', 12, 2030, true) RETURNING id INTO cs;
 INSERT INTO rede_tokenizacoes(aluno_id, tokenization_id, status, origem, cartao_salvo_id, token_code, token_expiration, cardholder_name, last4)
 VALUES (aluno, 'TESTE-TOK-1', 'active', 'link_cadastro', cs, 'TESTE', '12/2030', 'NICOLAS TESTE', '0000') RETURNING id INTO tk;

 -- 1) Venda manual Start 3x recorrente (R$ 403 com desconto em todos os meses)
 r := fn_venda_2027_gravar(jsonb_build_object('aluno_id',aluno,'catalogo_id','c81432f2-d252-475c-8026-680ef7e01d95','forma','recorrencia',
   'data_inicio','2026-10-20','servicos','[]'::jsonb,'idempotency_key',gen_random_uuid()),'66aa47d0-dc40-493d-8370-7d80eb54b8d6',true,'manual','manual',false);
 v := (r->>'venda_id')::uuid; k := (r->>'contrato_id')::uuid;
 SELECT plano_id INTO pl FROM contratos WHERE id = k;
 SELECT id INTO cb1 FROM cobrancas WHERE contrato_id = k AND numero_ciclo = 1;
 UPDATE cobrancas SET valor = 403 WHERE id = cb1;
 UPDATE vendas SET desconto = 196, valor_final = 403 WHERE id = v;
 UPDATE planos SET desconto_recorrente = 196 WHERE id = pl;
 UPDATE contratos SET cartao_token_id = cs WHERE id = k;

 -- 2) Ciclo 1 pago pelo fluxo manual → gera só a mensalidade nº 2
 a := fn_manual_primeiro_ciclo_reservar(v, gen_random_uuid()::text, 'token');
 pr := (a->>'pagamento_id')::uuid;
 a := fn_manual_primeiro_ciclo_liquidar(v, pr, jsonb_build_object('tid','TEST-C1','nsu','1','return_code','00'));
 SELECT count(*) INTO n FROM planos_2027_mensalidades WHERE venda_origem_id = v;
 IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 mensalidade, veio %', n; END IF;
 SELECT * INTO m2 FROM planos_2027_mensalidades WHERE venda_origem_id = v;
 IF m2.numero <> 2 OR m2.valor_centavos <> 40300 OR m2.vencimento <> '2026-11-20' OR m2.tokenizacao_id <> tk THEN RAISE EXCEPTION 'Mensalidade 2 errada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = m2.cobranca_id AND numero_ciclo = 2 AND valor = 403 AND status = 'pendente' AND contrato_id = k) THEN RAISE EXCEPTION 'Cobrança 2 errada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = cb1 AND status = 'pago') THEN RAISE EXCEPTION 'Ciclo 1 mexido'; END IF;

 -- 3) Reexecução idempotente (liquidar de novo + gerar de novo)
 PERFORM fn_manual_primeiro_ciclo_liquidar(v, pr, NULL);
 a := fn_mensalidade_manual_gerar(v);
 IF a->>'motivo' <> 'ja_gerado' THEN RAISE EXCEPTION 'Gerar não idempotente'; END IF;
 SELECT count(*) INTO n FROM cobrancas WHERE contrato_id = k; IF n <> 2 THEN RAISE EXCEPTION 'Cobranças duplicadas: %', n; END IF;

 -- 4) Cron: devida em 20/11; NICOLAS em modo simulação nunca vai à Rede
 IF NOT EXISTS (SELECT 1 FROM fn_recorrencia_2027_devidas('2026-11-20') d WHERE d.id = m2.id) THEN RAISE EXCEPTION 'Não está nas devidas'; END IF;
 IF EXISTS (SELECT 1 FROM fn_recorrencia_2027_devidas('2026-11-19') d WHERE d.id = m2.id) THEN RAISE EXCEPTION 'Devida antes do vencimento'; END IF;
 s := fn_recorrencia_2027_pode_cobrar(m2.id); IF s <> 'teste_sem_modo_real' THEN RAISE EXCEPTION 'pode_cobrar teste: %', s; END IF;
 -- Divergência de valor bloqueia
 PERFORM set_config('fortem.espelho_2027','on',true); UPDATE cobrancas SET valor = 402 WHERE id = m2.cobranca_id; PERFORM set_config('fortem.espelho_2027','off',true);
 s := fn_recorrencia_2027_pode_cobrar(m2.id); IF s <> 'manual_bloqueada' THEN RAISE EXCEPTION 'Valor divergente não bloqueou: %', s; END IF;
 PERFORM set_config('fortem.espelho_2027','on',true); UPDATE cobrancas SET valor = 403 WHERE id = m2.cobranca_id; PERFORM set_config('fortem.espelho_2027','off',true);

 -- 5) Simulação de aprovação (sem Rede): paga a 2, cria só a 3 (20/12)
 SELECT * INTO x FROM fn_recorrencia_2027_reservar(m2.id); IF x.id IS NULL THEN RAISE EXCEPTION 'Reserva falhou'; END IF;
 SELECT * INTO x FROM fn_recorrencia_2027_reservar(m2.id); IF x.id IS NOT NULL THEN RAISE EXCEPTION 'Reserva dupla'; END IF;
 s := fn_recorrencia_2027_resultado_rede(m2.id,'aprovado','SIM-TID-2','N2','A2','00','ok',NULL,'2026-11-20');
 IF s <> 'pago' THEN RAISE EXCEPTION 'Resultado: %', s; END IF;
 IF NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = m2.cobranca_id AND status = 'pago' AND tid = 'SIM-TID-2' AND gateway = 'rede') THEN RAISE EXCEPTION 'Cobrança 2 não baixada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pagamentos_rede WHERE mensalidade_2027_id = m2.id AND cobranca_id = m2.cobranca_id AND status = 'approved' AND amount = 40300) THEN RAISE EXCEPTION 'Pagamento não registrado'; END IF;
 s := fn_recorrencia_2027_resultado_rede(m2.id,'aprovado','SIM-TID-2B','N','A','00','ok',NULL,'2026-11-20');
 IF s <> 'ignorado' THEN RAISE EXCEPTION 'Segundo resultado aceito'; END IF;
 SELECT count(*) INTO n FROM pagamentos_rede WHERE mensalidade_2027_id = m2.id; IF n <> 1 THEN RAISE EXCEPTION 'Pagamento duplicado'; END IF;
 SELECT * INTO m3 FROM planos_2027_mensalidades WHERE venda_origem_id = v AND numero = 3;
 IF m3.id IS NULL OR m3.vencimento <> '2026-12-20' OR m3.valor_centavos <> 40300 THEN RAISE EXCEPTION 'Mensalidade 3 errada'; END IF;
 SELECT count(*) INTO n FROM planos_2027_mensalidades WHERE venda_origem_id = v; IF n <> 2 THEN RAISE EXCEPTION 'Gerou mais de um ciclo à frente'; END IF;

 -- 6) Renovação mensal do Start (igual ao site): novo contrato recebe as mensalidades, sem cobrança pendente extra
 ren := fn_renovar_start_2027(pl, '2026-11-20');
 IF ren->>'contrato_id' IS NULL THEN RAISE EXCEPTION 'Renovação não ocorreu: %', ren; END IF;
 k2 := (ren->>'contrato_id')::uuid;
 IF EXISTS (SELECT 1 FROM cobrancas WHERE contrato_id = k2 AND numero_ciclo = 1) THEN RAISE EXCEPTION 'Renovação criou cobrança extra'; END IF;
 IF NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = m3.cobranca_id AND contrato_id = k2) THEN RAISE EXCEPTION 'Cobrança 3 não migrou'; END IF;
 IF (SELECT cartao_token_id FROM contratos WHERE id = k2) IS DISTINCT FROM cs THEN RAISE EXCEPTION 'Cartão não seguiu o contrato'; END IF;
 IF NOT EXISTS (SELECT 1 FROM vendas WHERE id = (ren->>'venda_id')::uuid AND status_pagamento = 'pago' AND valor_final = 403) THEN RAISE EXCEPTION 'Venda de renovação errada'; END IF;
 ren := fn_renovar_start_2027((ren->>'plano_id')::uuid, '2026-11-21');
 IF ren->>'pulado' IS NULL THEN RAISE EXCEPTION 'Renovou duas vezes'; END IF;
 -- Créditos do novo ciclo só com a mensalidade paga
 PERFORM fn_creditos_mensais_2027('2026-11-21');
 SELECT count(*) INTO n FROM creditos_aluno ca JOIN vendas vv ON vv.id = ca.origem_id WHERE vv.plano_id = (SELECT plano_id FROM contratos WHERE id = k2) AND ca.competencia = '2026-11-20';
 IF n <> 1 THEN RAISE EXCEPTION 'Créditos do ciclo 2: %', n; END IF;
 PERFORM fn_creditos_mensais_2027('2026-11-22');
 SELECT count(*) INTO n FROM creditos_aluno ca JOIN vendas vv ON vv.id = ca.origem_id WHERE vv.plano_id = (SELECT plano_id FROM contratos WHERE id = k2) AND ca.competencia = '2026-11-20';
 IF n <> 1 THEN RAISE EXCEPTION 'Créditos em dobro'; END IF;

 -- 7) Troca de cartão no contrato: pendentes passam ao novo token
 INSERT INTO cartoes_salvos(aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo)
 VALUES (aluno, 'TESTE-TOKEN-2', 'Visa', '1111', 'NICOLAS TESTE', 12, 2031, true) RETURNING id INTO cs2;
 INSERT INTO rede_tokenizacoes(aluno_id, tokenization_id, status, origem, cartao_salvo_id, token_code, token_expiration, cardholder_name, last4)
 VALUES (aluno, 'TESTE-TOK-2', 'active', 'link_cadastro', cs2, 'TESTE2', '12/2031', 'NICOLAS TESTE', '1111') RETURNING id INTO tk2;
 UPDATE contratos SET cartao_token_id = cs2 WHERE id = k2;
 IF (SELECT tokenizacao_id FROM planos_2027_mensalidades WHERE id = m3.id) <> tk2 THEN RAISE EXCEPTION 'Troca de cartão não aplicada'; END IF;

 -- 8) Cartão recusado 3x → inadimplente, cobrança atrasada, aviso à equipe; sem 4ª tentativa
 FOR n IN 1..3 LOOP
   PERFORM fn_recorrencia_2027_reservar(m3.id);
   s := fn_recorrencia_2027_resultado_rede(m3.id,'recusado',NULL,NULL,NULL,'05','negado','recusado','2026-12-20');
 END LOOP;
 IF s <> 'inadimplente' THEN RAISE EXCEPTION 'Esperava inadimplente: %', s; END IF;
 IF NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = m3.cobranca_id AND status = 'atrasado' AND tentativas = 3) THEN RAISE EXCEPTION 'Cobrança 3 não atrasada'; END IF;
 IF (SELECT notificacao_inadimplencia_id FROM planos_2027_mensalidades WHERE id = m3.id) IS NULL THEN RAISE EXCEPTION 'Sem aviso'; END IF;
 IF EXISTS (SELECT 1 FROM fn_recorrencia_2027_devidas('2027-01-01') d WHERE d.id = m3.id) THEN RAISE EXCEPTION '4ª tentativa'; END IF;

 -- 9) Equipe dá baixa manual na cobrança → mensalidade paga, próxima criada (20/01)
 UPDATE cobrancas SET status = 'pago', data_pagamento = '2026-12-22', gateway = 'inter_pix' WHERE id = m3.cobranca_id;
 IF (SELECT status FROM planos_2027_mensalidades WHERE id = m3.id) <> 'pago' THEN RAISE EXCEPTION 'Baixa manual não refletiu'; END IF;
 IF (SELECT gateway FROM cobrancas WHERE id = m3.cobranca_id) <> 'inter_pix' THEN RAISE EXCEPTION 'Baixa da equipe sobrescrita'; END IF;
 SELECT * INTO m4 FROM planos_2027_mensalidades WHERE venda_origem_id = v AND numero = 4;
 IF m4.id IS NULL OR m4.vencimento <> '2027-01-20' THEN RAISE EXCEPTION 'Mensalidade 4 errada'; END IF;

 -- 10) Cancelamento agendado e imediato
 UPDATE contratos SET data_cancelamento = '2027-01-19' WHERE id = k2;
 IF (SELECT status FROM planos_2027_mensalidades WHERE id = m4.id) <> 'cancelado' THEN RAISE EXCEPTION 'Cancelamento agendado não parou'; END IF;
 IF (SELECT status FROM cobrancas WHERE id = m4.cobranca_id) <> 'cancelado' THEN RAISE EXCEPTION 'Cobrança 4 não cancelada'; END IF;

 -- 11) Power recorrente: 2..12 sobre as cobranças já criadas
 rp := fn_venda_2027_gravar(jsonb_build_object('aluno_id',aluno,'catalogo_id','42e1e025-906e-472f-8f88-d45a18fc8bd8','forma','recorrencia',
   'data_inicio','2026-10-21','servicos','[]'::jsonb,'idempotency_key',gen_random_uuid()),'66aa47d0-dc40-493d-8370-7d80eb54b8d6',true,'manual','manual',false);
 vp := (rp->>'venda_id')::uuid; kp := (rp->>'contrato_id')::uuid;
 UPDATE contratos SET cartao_token_id = cs WHERE id = kp;
 a := fn_manual_primeiro_ciclo_reservar(vp, gen_random_uuid()::text, 'token');
 PERFORM fn_manual_primeiro_ciclo_liquidar(vp, (a->>'pagamento_id')::uuid, jsonb_build_object('tid','TEST-P1','return_code','00'));
 SELECT count(*) INTO n FROM planos_2027_mensalidades m JOIN cobrancas c ON c.id = m.cobranca_id
  WHERE m.venda_origem_id = vp AND c.numero_ciclo = m.numero AND round(c.valor*100) = m.valor_centavos AND c.data_vencimento = m.vencimento;
 IF n <> 11 THEN RAISE EXCEPTION 'Power: esperava 11 mensalidades, veio %', n; END IF;
 SELECT count(*) INTO n FROM cobrancas WHERE contrato_id = kp; IF n <> 12 THEN RAISE EXCEPTION 'Power: cobranças alteradas %', n; END IF;

 RAISE EXCEPTION 'ENSAIO OK (desfeito)';
END $test$;
ROLLBACK;
