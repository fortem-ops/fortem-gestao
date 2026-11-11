-- Plano Semestral, Etapa 3: ensaio revertido (termina sempre em exceção => nada é gravado).
-- Saída esperada: "ENSAIO_OK: ..."; qualquer regra quebrada termina em "FALHOU: ...".
DO $t$
DECLARE
  v_aluno uuid := 'f0ddccf9-3e24-485b-bfc9-5e7bf1c62fa9';  -- aluna Wellhub real ativa
  v_admin uuid := '66aa47d0-dc40-493d-8370-7d80eb54b8d6';
  v_aluno_user uuid; r jsonb; v_cat uuid; k public.contratos; n int; v_cob uuid; v_tpl text; v_res text := '';
BEGIN
  UPDATE public.planos_catalogo SET ativo = true WHERE familia = 'semestral_2027';
  UPDATE public.contrato_templates SET ativo = true WHERE plano_tipo IN ('semestral_wellhub','semestral_totalpass');

  -- Listas genéricas não trazem Semestral (Nova Venda 2027, legado, /planos público).
  SELECT count(*) INTO n FROM public.planos_catalogo WHERE versao = 2027 AND agregadora_requerida IS NULL AND familia = 'semestral_2027';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: lista 2027 genérica trouxe Semestral'; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(public.fn_planos_publico_2027()->'planos') x WHERE x->>'familia' = 'semestral_2027';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: /planos público trouxe Semestral'; END IF;
  SELECT count(*) INTO n FROM public.fn_semestral_itens_elegiveis(v_aluno);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: elegíveis Wellhub = %', n; END IF;
  v_res := v_res || '1 listas genéricas sem Semestral, elegíveis=2; ';

  -- Leitura por papel (RLS).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.planos_catalogo WHERE familia = 'semestral_2027';
  IF n <> 4 THEN RAISE EXCEPTION 'FALHOU: equipe leu % itens', n; END IF;
  RESET ROLE;
  SELECT a.user_id INTO v_aluno_user FROM public.alunos a WHERE a.user_id IS NOT NULL AND NOT public.is_staff(a.user_id) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_aluno_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.planos_catalogo WHERE familia = 'semestral_2027';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno leu % itens', n; END IF;
  RESET ROLE;
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.planos_catalogo WHERE familia = 'semestral_2027';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: anônimo leu % itens', n; END IF;
  RESET ROLE;
  v_res := v_res || '2 equipe lê 4, aluno 0, anônimo 0; ';

  -- Venda Start Semestral como admin.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SELECT id INTO v_cat FROM public.planos_catalogo WHERE codigo = 'start_semestral_wellhub_3x';
  r := public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat, 'idempotency_key', 'ensaio-sem3'));
  SELECT * INTO k FROM public.contratos WHERE id = (r->>'contrato_id')::uuid;
  IF k.plano_tipo <> 'semestral_2027' OR k.forma_pagamento <> 'cartao_recorrencia' OR k.data_fim - k.data_inicio <> 30 THEN
    RAISE EXCEPTION 'FALHOU: contrato % % %', k.plano_tipo, k.forma_pagamento, k.data_fim - k.data_inicio; END IF;
  SELECT t.plano_tipo INTO v_tpl FROM public.contrato_templates t JOIN public.planos_catalogo c ON c.id = k.catalogo_id
   WHERE t.plano_tipo = 'semestral_' || c.agregadora_requerida AND t.forma_pagamento = 'cartao_recorrencia' AND t.ativo;
  IF v_tpl IS DISTINCT FROM 'semestral_wellhub' OR r->>'contrato_modelo' <> 'semestral_wellhub' THEN RAISE EXCEPTION 'FALHOU: modelo %', v_tpl; END IF;
  SELECT count(*) INTO n FROM public.cobrancas WHERE contrato_id = k.id;
  SELECT id INTO v_cob FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1 AND valor = 439 AND status = 'pendente';
  IF n <> 1 OR v_cob IS NULL THEN RAISE EXCEPTION 'FALHOU: mensalidade nº1 (% cobranças)', n; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id = (r->>'venda_id')::uuid AND atividade = 'Treino';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: Treino antes do pagamento'; END IF;
  SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id IN ((r->>'venda_id')::uuid, (r->>'plano_id')::uuid) AND atividade = 'Avaliação Funcional';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: % créditos de Avaliação Funcional', n; END IF;
  -- Etapa 4B: até a 1ª mensalidade ser paga, o Wellhub segue ativo.
  SELECT count(*) INTO n FROM public.planos WHERE aluno_id = v_aluno AND tipo = 'Gympass/Wellhub' AND ativo;
  IF n = 0 THEN RAISE EXCEPTION 'FALHOU: Wellhub encerrado antes do pagamento'; END IF;
  v_res := v_res || '3 contrato semestral_wellhub 30 dias, mensalidade nº1 R$439 pendente, 0 Treino, 1 Avaliação (inativa), Wellhub ativo até pagar; ';

  -- Pagamento simulado do ciclo 1 (sem provedor): libera 12, uma vez.
  UPDATE public.cobrancas SET status = 'pago', data_pagamento = CURRENT_DATE WHERE id = v_cob;
  UPDATE public.cobrancas SET status = 'pendente' WHERE id = v_cob;
  UPDATE public.cobrancas SET status = 'pago' WHERE id = v_cob;
  SELECT COALESCE(sum(quantidade_inicial), 0) INTO n FROM public.creditos_aluno WHERE origem_id = (r->>'venda_id')::uuid AND atividade = 'Treino';
  IF n <> 12 THEN RAISE EXCEPTION 'FALHOU: Treino após pagamento = %', n; END IF;
  SELECT count(*) INTO n FROM public.planos WHERE aluno_id = v_aluno AND tipo = 'Gympass/Wellhub' AND ativo;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: Wellhub segue ativo após pagar'; END IF;
  SELECT count(*) INTO n FROM public.planos WHERE aluno_id = v_aluno AND tipo = 'Gympass/Wellhub' AND NOT ativo AND data_fim = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF n < 1 THEN RAISE EXCEPTION 'FALHOU: Wellhub sem data_fim de hoje'; END IF;
  IF (public.fn_plano_principal_ativo(v_aluno)).catalogo_id IS DISTINCT FROM v_cat THEN RAISE EXCEPTION 'FALHOU: plano principal não é o Semestral'; END IF;
  v_res := v_res || '4 pago => 12 Treino (sem duplicar), Wellhub encerrado, principal=Semestral; ';

  -- Recontratação pelo mesmo CPF é recusada.
  BEGIN
    PERFORM public.fn_venda_semestral_criar(jsonb_build_object('aluno_id', v_aluno, 'catalogo_id', v_cat));
    RAISE EXCEPTION 'FALHOU: segunda venda aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  v_res := v_res || '5 segunda venda recusada';
  RAISE EXCEPTION 'ENSAIO_OK: %', v_res;
END $t$;
