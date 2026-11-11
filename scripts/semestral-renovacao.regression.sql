-- Plano Semestral, Etapa 4: ensaio revertido (termina sempre em exceção => nada é gravado).
-- Saída esperada: "ENSAIO_OK: ..."; qualquer regra quebrada termina em "FALHOU: ...".
DO $t$
DECLARE
  v_aluno uuid := 'f0ddccf9-3e24-485b-bfc9-5e7bf1c62fa9';  -- aluna Wellhub real ativa
  v_admin uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  r jsonb; v_cat uuid; k public.contratos; n int; v_cs uuid; v_tk uuid; m public.planos_2027_mensalidades;
  v_ini date; v_res text := ''; i int; v_txt text; v_atual int;
BEGIN
  UPDATE public.planos_catalogo SET ativo = true WHERE familia = 'semestral_2027';
  UPDATE public.contrato_templates SET ativo = true WHERE plano_tipo IN ('semestral_wellhub','semestral_totalpass');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SELECT id INTO v_cat FROM public.planos_catalogo WHERE codigo = 'start_semestral_wellhub_3x';
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-sem4'));
  SELECT * INTO k FROM public.contratos WHERE id = (r->>'contrato_id')::uuid;
  v_ini := k.data_inicio;
  -- Cartão salvo de ensaio (não é enviado a lugar nenhum) e reajuste manual do contrato para 459.
  INSERT INTO public.cartoes_salvos (aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year)
  VALUES (v_aluno, 'ENSAIO', 'visa', '0000', 'ENSAIO', 12, 2030) RETURNING id INTO v_cs;
  INSERT INTO public.rede_tokenizacoes (tokenization_id, aluno_id, cartao_salvo_id, status, origem)
  VALUES ('ENSAIO-SEM4', v_aluno, v_cs, 'active', 'recepcao') RETURNING id INTO v_tk;
  UPDATE public.contratos SET cartao_token_id = v_cs, valor_cobrado = 459 WHERE id = k.id;

  -- 1) Pagamento da nº 1 (equipe) => 12 Treinos do ciclo 1 e mensalidade nº 2 gerada uma vez, com o valor da venda.
  UPDATE public.cobrancas SET status = 'pago', data_pagamento = v_ini WHERE contrato_id = k.id AND numero_ciclo = 1;
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid;
  SELECT * INTO m FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid AND numero = 2;
  IF n <> 1 OR m.valor_centavos <> 43900 OR m.vencimento <> v_ini + 30 THEN
    RAISE EXCEPTION 'FALHOU: ciclo 2 (% linhas, % centavos, venc %)', n, m.valor_centavos, m.vencimento; END IF;
  PERFORM public.fn_mensalidade_manual_gerar((r->>'venda_id')::uuid);
  PERFORM public.fn_mensalidade_manual_proximo((r->>'venda_id')::uuid);
  PERFORM public.fn_semestral_diario(v_ini + 1);
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: ciclo 2 duplicado (%)', n; END IF;
  v_res := v_res || '1 ciclo2 gerado 1x R$439 venc ' || m.vencimento || '; ';

  -- 2) Cobrança diária pega a mensalidade do Semestral e não pega nenhum plano atual.
  UPDATE public.sistema_config SET valor = to_jsonb('true'::text) WHERE chave = 'planos_recorrencia_ativa';
  SELECT count(*) INTO n FROM public.fn_recorrencia_2027_devidas(v_ini + 30, 50) d WHERE d.id = m.id;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: cobrança diária não pegou o Semestral'; END IF;
  SELECT count(*) INTO n FROM public.fn_recorrencia_2027_devidas(v_ini + 30, 50) d
    JOIN public.contratos kk ON kk.id = d.contrato_id LEFT JOIN public.planos_catalogo pc ON pc.id = kk.catalogo_id
   WHERE pc.versao IS DISTINCT FROM 2027;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: cobrança diária pegou % plano(s) atual(is)', n; END IF;
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades d JOIN public.contratos kk ON kk.id = d.contrato_id
    LEFT JOIN public.planos_catalogo pc ON pc.id = kk.catalogo_id WHERE pc.versao IS DISTINCT FROM 2027;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: % mensalidades de planos atuais', n; END IF;
  v_res := v_res || '2 cobrança diária pega o Semestral, 0 planos atuais (pode_cobrar=' || public.fn_recorrencia_2027_pode_cobrar(m.id) || '); ';

  -- 3) Créditos do ciclo 2 bloqueados até o pagamento; liberados uma vez (resultado repetido é ignorado).
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = (r->>'venda_id')::uuid AND atividade = 'Treino' AND competencia = v_ini + 30;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: Treino do ciclo 2 antes do pagamento'; END IF;
  -- Ciclos 2 a 6 pagos pelo caminho da cobrança diária (processando => aprovado).
  FOR i IN 2..6 LOOP
    SELECT * INTO m FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid AND numero = i;
    IF m.id IS NULL OR m.valor_centavos <> 43900 OR m.vencimento <> v_ini + 30 * (i - 1) THEN
      RAISE EXCEPTION 'FALHOU: ciclo % (% centavos)', i, m.valor_centavos; END IF;
    UPDATE public.planos_2027_mensalidades SET status = 'processando', tentativas = 1 WHERE id = m.id;
    v_txt := public.fn_recorrencia_2027_resultado(m.id, 'aprovado', 'ENSAIO' || i, NULL, m.vencimento);
    IF v_txt <> 'pago' THEN RAISE EXCEPTION 'FALHOU: resultado ciclo % = %', i, v_txt; END IF;
    v_txt := public.fn_recorrencia_2027_resultado(m.id, 'aprovado', 'ENSAIO' || i, NULL, m.vencimento);
    IF v_txt <> 'ignorado' THEN RAISE EXCEPTION 'FALHOU: resultado repetido ciclo % = %', i, v_txt; END IF;
  END LOOP;
  SELECT count(*), sum(quantidade_inicial) INTO n, v_atual FROM public.creditos_aluno WHERE origem_id = (r->>'venda_id')::uuid AND atividade = 'Treino';
  IF n <> 6 OR v_atual <> 72 THEN RAISE EXCEPTION 'FALHOU: Treinos % linhas / % créditos', n, v_atual; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = (r->>'venda_id')::uuid AND atividade = 'Treino' AND ativo;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: % créditos de Treino ativos (sem acúmulo = 1)', n; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = (r->>'venda_id')::uuid AND atividade = 'Treino'
     AND competencia = v_ini + 30 AND quantidade_inicial = 12 AND data_validade = v_ini + 59;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: Treino do ciclo 2 (validade/qtd)'; END IF;
  SELECT * INTO k FROM public.contratos WHERE id = k.id;
  IF k.data_fim <> v_ini + 180 THEN RAISE EXCEPTION 'FALHOU: vigência % (esperado %)', k.data_fim, v_ini + 180; END IF;
  v_res := v_res || '3 créditos só após pagar, 12 por ciclo, 6 ciclos = 72, sem duplicar, vigência até ' || k.data_fim || '; ';

  -- 4) Ciclo 7 com o valor do contrato (459), gerado uma vez.
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid AND numero = 7;
  SELECT * INTO m FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid AND numero = 7;
  IF n <> 1 OR m.valor_centavos <> 45900 OR m.vencimento <> v_ini + 180 THEN RAISE EXCEPTION 'FALHOU: ciclo 7 (% centavos)', m.valor_centavos; END IF;
  v_res := v_res || '4 ciclo7 R$459 (valor do contrato) venc ' || m.vencimento || '; ';

  -- 5) Cancelamento: só admin, sem multa, mensalidades futuras canceladas, acesso até o fim do ciclo pago.
  r := r || jsonb_build_object('cancel', public.fn_semestral_cancelar(k.id, 'ensaio'));
  SELECT * INTO k FROM public.contratos WHERE id = k.id;
  SELECT count(*) INTO n FROM public.planos_2027_mensalidades WHERE venda_origem_id = (r->>'venda_id')::uuid AND status NOT IN ('pago','cancelado');
  IF n <> 0 OR k.multa_percentual <> 0 OR (r->'cancel'->>'mensalidades_canceladas')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: cancelamento (% abertas, multa %, retorno %)', n, k.multa_percentual, r->'cancel'; END IF;
  SELECT count(*) INTO n FROM public.cobrancas WHERE contrato_id = k.id AND status IN ('pendente','atrasado');
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: % cobranças abertas após cancelar', n; END IF;
  IF public.fn_mensalidade_manual_proximo((r->>'venda_id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: gerou mensalidade após cancelar'; END IF;
  SELECT count(*) INTO n FROM public.fn_recorrencia_2027_devidas(v_ini + 400, 50) d WHERE d.venda_origem_id = (r->>'venda_id')::uuid;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: cobrança diária ainda pega o Semestral cancelado'; END IF;
  PERFORM public.fn_semestral_diario(k.data_fim - 1);
  IF NOT (SELECT ativo FROM public.planos WHERE id = k.plano_id) THEN RAISE EXCEPTION 'FALHOU: acesso cortado antes do fim do ciclo pago'; END IF;
  PERFORM public.fn_semestral_diario(k.data_fim);
  IF (SELECT ativo FROM public.planos WHERE id = k.plano_id) OR (SELECT status FROM public.contratos WHERE id = k.id) <> 'cancelado' THEN
    RAISE EXCEPTION 'FALHOU: não encerrou no fim do ciclo pago'; END IF;
  IF (public.fn_semestral_elegivel(v_aluno, 'pro_semestral_wellhub_3x', v_ini)->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHOU: recontratação permitida'; END IF;
  v_res := v_res || '5 cancelado sem multa, 1 mensalidade futura cancelada, acesso até ' || k.data_fim || ', sem recontratação; ';

  -- 6) Pix Automático desligado para o Semestral.
  BEGIN
    INSERT INTO public.pix_aut_itens (grupo_id, aluno_id, item_tipo, contrato_id, plano_id, descricao, valor)
    SELECT g.id, v_aluno, 'contrato', k.id, k.plano_id, 'ensaio', 439 FROM public.pix_aut_grupos g LIMIT 1;
    RAISE EXCEPTION 'FALHOU: Pix Automático aceitou o Semestral';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  v_res := v_res || '6 Pix Automático recusado para o Semestral';

  RAISE EXCEPTION 'ENSAIO_OK: %', v_res;
END $t$;
