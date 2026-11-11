-- Plano Semestral, Etapa 4C: desistência, expiração em 7 dias e CPF contando só venda paga.
-- Ensaio revertido (termina sempre em exceção); Rede simulada, nenhuma chamada externa.
DO $t$
DECLARE
  v_aluno uuid := 'f0ddccf9-3e24-485b-bfc9-5e7bf1c62fa9';  -- aluna Wellhub real ativa
  v_admin uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  v_coord uuid := '8a7a77b8-8a6d-4aa1-9e55-76ff8b5e79e0';
  v_cat uuid; r jsonb; v1 uuid; v2 uuid; v3 uuid; k public.contratos; n int; v_cs uuid; v_well uuid; v_res text := ''; v_ok boolean; res jsonb;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  UPDATE public.planos_catalogo SET ativo = true WHERE familia = 'semestral_2027';
  UPDATE public.contrato_templates SET ativo = true WHERE plano_tipo IN ('semestral_wellhub','semestral_totalpass');
  SELECT id INTO v_well FROM public.planos WHERE aluno_id = v_aluno AND ativo AND tipo = 'Gympass/Wellhub' LIMIT 1;
  SELECT id INTO v_cat FROM public.planos_catalogo WHERE codigo = 'pro_semestral_wellhub_3x';

  -- 1) Desistência pelo coordenador.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-4c-1'));
  v1 := (r->>'venda_id')::uuid;
  SELECT * INTO k FROM public.contratos WHERE id = (r->>'contrato_id')::uuid;
  IF NOT (public.fn_semestral_elegivel(v_aluno, 'pro_semestral_wellhub_3x')->>'elegivel')::boolean THEN
    RAISE EXCEPTION 'FALHOU: venda aberta (não paga) bloqueou o CPF'; END IF;
  r := public.fn_semestral_desistir(v1, 'ensaio desistência');
  r := public.fn_semestral_desistir(v1, 'ensaio repetido');
  IF NOT (r->>'repetida')::boolean THEN RAISE EXCEPTION 'FALHOU: desistência repetida %', r; END IF;
  IF (SELECT status_pagamento::text FROM public.vendas WHERE id = v1) <> 'cancelado'
     OR (SELECT status FROM public.contratos WHERE id = k.id) <> 'cancelado'
     OR (SELECT status FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1) <> 'cancelado'
     OR EXISTS (SELECT 1 FROM public.planos_2027_mensalidades WHERE venda_origem_id = v1 AND status <> 'cancelado')
     OR (SELECT ativo FROM public.planos WHERE id = k.plano_id) THEN RAISE EXCEPTION 'FALHOU: desistência não encerrou tudo'; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE aluno_id = v_aluno AND origem_id IN (v1, k.plano_id) AND ativo;
  IF n <> 0 OR NOT (SELECT ativo FROM public.planos WHERE id = v_well) THEN RAISE EXCEPTION 'FALHOU: créditos ligados ou Wellhub encerrado'; END IF;
  IF NOT (public.fn_semestral_elegivel(v_aluno, 'pro_semestral_wellhub_3x')->>'elegivel')::boolean THEN
    RAISE EXCEPTION 'FALHOU: venda desistida contou como contratação'; END IF;
  v_res := v_res || '1 desistência (coordenador): venda/contrato/nº1 cancelados, 0 créditos, Wellhub ativo, CPF livre; ';

  -- Professor não desiste.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM user_roles WHERE role='professor'
     AND user_id NOT IN (SELECT user_id FROM user_roles WHERE role IN ('admin','coordenador')) LIMIT 1), 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.fn_semestral_desistir(v1, 'x'); v_ok := true; EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: professor desistiu'; END IF;

  -- 2) Nova venda depois da desistência; expiração automática após 7 dias.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-4c-2'));
  v2 := (r->>'venda_id')::uuid;
  IF v2 = v1 THEN RAISE EXCEPTION 'FALHOU: retomou venda desistida'; END IF;
  r := public.fn_semestral_diario(v_hoje + 7);
  IF (SELECT status_pagamento::text FROM public.vendas WHERE id = v2) = 'cancelado' THEN RAISE EXCEPTION 'FALHOU: expirou com 7 dias'; END IF;
  -- Pagamento em andamento no 8º dia: não expira, gera um aviso só.
  INSERT INTO public.cartoes_salvos (aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year)
  VALUES (v_aluno, 'ENSAIO', 'visa', '0000', 'ENSAIO TITULAR', 12, 2030) RETURNING id INTO v_cs;
  INSERT INTO public.rede_tokenizacoes (tokenization_id, aluno_id, cartao_salvo_id, status, origem) VALUES ('ENSAIO-4C', v_aluno, v_cs, 'active', 'recepcao');
  PERFORM public.fn_semestral_definir_cartao(v2, v_cs);
  res := public.fn_manual_primeiro_ciclo_reservar(v2, 'ensaio-4c-t1', 'token', v_cs, NULL);
  r := public.fn_semestral_diario(v_hoje + 8);
  r := public.fn_semestral_diario(v_hoje + 9);
  IF (SELECT status_pagamento::text FROM public.vendas WHERE id = v2) = 'cancelado' THEN RAISE EXCEPTION 'FALHOU: expirou com pagamento em andamento'; END IF;
  SELECT count(*) INTO n FROM public.system_logs WHERE acao = 'expiracao_conferir' AND payload->>'venda_id' = v2::text;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: % avisos de conferência', n; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.fn_semestral_desistir(v2, 'x'); v_ok := true; EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: desistiu com pagamento em andamento'; END IF;
  -- Rede responde recusado: no dia seguinte expira (mais de 7 dias).
  UPDATE public.pagamentos_rede SET status = 'denied', return_code = '05' WHERE id = (res->>'pagamento_id')::uuid;
  r := public.fn_semestral_diario(v_hoje + 10);
  IF (SELECT status_pagamento::text FROM public.vendas WHERE id = v2) <> 'cancelado' OR (r->>'vendas_expiradas')::int < 1 THEN
    RAISE EXCEPTION 'FALHOU: não expirou após recusa %', r; END IF;
  IF NOT (SELECT ativo FROM public.planos WHERE id = v_well)
     OR NOT (public.fn_semestral_elegivel(v_aluno, 'pro_semestral_wellhub_3x')->>'elegivel')::boolean THEN
    RAISE EXCEPTION 'FALHOU: expiração encerrou Wellhub ou bloqueou CPF'; END IF;
  v_res := v_res || '2 expiração: 7 dias não expira; 8º dia com pagamento em andamento só avisa (1 aviso); após recusa expira; Wellhub ativo; CPF livre; ';

  -- 3) Venda paga e ativada bloqueia o CPF mesmo cancelada depois.
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-4c-3'));
  v3 := (r->>'venda_id')::uuid;
  PERFORM public.fn_semestral_definir_cartao(v3, v_cs);
  res := public.fn_manual_primeiro_ciclo_reservar(v3, 'ensaio-4c-t3', 'token', v_cs, NULL);
  r := public.fn_manual_primeiro_ciclo_liquidar(v3, (res->>'pagamento_id')::uuid,
         jsonb_build_object('tid', 'ENSAIO-TID', 'nsu', 'ENSAIO-NSU', 'return_code', '00', 'return_message', 'Aprovado'));
  IF NOT (SELECT ativo FROM public.planos p JOIN public.vendas v ON v.plano_id = p.id WHERE v.id = v3) THEN RAISE EXCEPTION 'FALHOU: não ativou'; END IF;
  BEGIN PERFORM public.fn_semestral_desistir(v3, 'x'); v_ok := true; EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  IF v_ok THEN RAISE EXCEPTION 'FALHOU: desistiu de venda paga'; END IF;
  SELECT * INTO k FROM public.contratos WHERE plano_id = (SELECT plano_id FROM public.vendas WHERE id = v3);
  PERFORM public.fn_semestral_cancelar(k.id, 'ensaio');
  UPDATE public.planos SET ativo = true, data_fim = NULL WHERE id = v_well;  -- isola a regra do CPF
  IF (public.fn_semestral_elegivel(v_aluno, 'start_semestral_wellhub_3x')->>'motivo') NOT LIKE 'Este CPF já contratou%' THEN
    RAISE EXCEPTION 'FALHOU: venda paga e cancelada liberou o CPF'; END IF;
  RAISE EXCEPTION 'ENSAIO_OK: %3 paga e ativada: desistência recusada, cancelada depois e CPF segue bloqueado', v_res;
END $t$;
