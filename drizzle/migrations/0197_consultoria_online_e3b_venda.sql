-- E3b PROPOSTA (NÃO APLICADA). Consultoria Online na venda do servidor; Start/Power/Pro inalterados.
-- Mesma assinatura, SECURITY DEFINER e search_path=public; permissões reaplicadas iguais às atuais.

CREATE OR REPLACE FUNCTION public.fn_venda_2027_gravar(p jsonb, p_uid uuid, p_teste boolean, p_origem text, p_canal text, p_sem_cobrancas boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := p_uid;
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_forma text := p->>'forma';
  v_n int := COALESCE((p->>'parcelas')::int, 1);
  v_forma_s text := COALESCE(p->>'forma_servicos', 'pix_vista');
  v_n_s int := COALESCE((p->>'parcelas_servicos')::int, 1);
  v_ini date := COALESCE((p->>'data_inicio')::date, CURRENT_DATE);
  v_venc date;
  v_idem text := NULLIF(p->>'idempotency_key', '');
  v_substituir boolean := COALESCE((p->>'substituir')::boolean, false);
  v_obs text := NULLIF(btrim(COALESCE(p->>'observacoes', '')), '');
  v_teste boolean;
  v_origem text;
  c record;
  s record;
  v_ehstart boolean; v_ehmensal boolean;
  v_cons boolean; v_ciclo boolean; v_pacote boolean; v_meses int;
  v_valor_c bigint; v_taxa_c bigint := 0; v_serv_c bigint := 0; v_mensal_c bigint;
  v_plano_total_c bigint; v_total_c bigint; v_base bigint; v_pbase bigint; v_parc bigint; v_pparc bigint;
  v_embutir boolean;
  v_venda_id uuid; v_plano_id uuid; v_contrato_id uuid;
  v_serv_vendas jsonb := '[]'::jsonb;
  v_serv_ids uuid[] := ARRAY[]::uuid[];
  v_sid uuid; v_comp jsonb; v_cred uuid;
  v_fim_plano date; v_fim_ciclo date; v_valid12 date;
  v_freq smallint; v_qtd int; i int; m int; k int;
  v_forma_venda text; v_forma_contrato text;
  v_existente uuid;
BEGIN
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;

  IF v_idem IS NOT NULL THEN
    SELECT id INTO v_existente FROM public.vendas WHERE idempotency_key = v_idem AND tipo = 'plano' LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('venda_id', v_existente, 'repetida', true);
    END IF;
  END IF;

  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid AND versao = 2027;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item 2027 não encontrado'; END IF;

  v_teste := COALESCE(p_teste, false);
  v_origem := p_origem;

  IF NOT v_teste AND NOT (c.ativo AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= CURRENT_DATE)
                          AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Plano 2027 ainda não liberado para venda';
  END IF;

  v_ehstart := c.familia = 'start_2027';
  v_ehmensal := c.modalidade_cobranca = 'recorrencia_mensal';
  v_cons := c.familia = 'consultoria_2027';
  v_ciclo := v_ehstart OR (v_cons AND v_ehmensal);
  v_pacote := c.modalidade_cobranca = 'pacote';
  IF v_pacote AND NOT v_cons THEN RAISE EXCEPTION 'Pacote só existe na Consultoria Online'; END IF;
  IF v_cons AND NOT (v_ehmensal OR v_pacote) THEN RAISE EXCEPTION 'Consultoria Online é mensal ou pacote'; END IF;
  IF v_pacote AND COALESCE(c.periodo_meses, 0) NOT IN (4, 6) THEN RAISE EXCEPTION 'Pacote da Consultoria deve ser de 4 ou 6 meses'; END IF;
  IF v_pacote AND jsonb_array_length(COALESCE(p->'servicos', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Pacote da Consultoria não aceita serviços na mesma venda; venda os serviços separadamente';
  END IF;

  IF v_ehstart AND NOT v_ehmensal THEN RAISE EXCEPTION 'Start 2027 é só recorrência mensal'; END IF;
  IF v_ehmensal AND v_forma <> 'recorrencia' THEN RAISE EXCEPTION 'Item mensal só pode ser vendido em recorrência'; END IF;
  IF NOT v_ehmensal AND v_forma NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF v_pacote AND v_forma = 'cartao_parcelado' AND (v_n < 1 OR v_n > c.periodo_meses) THEN RAISE EXCEPTION 'Parcelas devem ser entre 1 e %', c.periodo_meses; END IF;
  IF v_forma = 'cartao_parcelado' AND (v_n < 1 OR v_n > 12) THEN RAISE EXCEPTION 'Parcelas devem ser entre 1 e 12'; END IF;
  IF v_forma = 'pix_vista' THEN v_n := 1; END IF;
  IF v_forma = 'recorrencia' THEN v_n := CASE WHEN v_ciclo THEN 1 ELSE 12 END; END IF;
  IF v_forma_s NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento dos serviços inválida'; END IF;
  IF v_forma_s = 'pix_vista' THEN v_n_s := 1; END IF;
  IF v_n_s < 1 OR v_n_s > 6 THEN RAISE EXCEPTION 'Parcelas dos serviços devem ser entre 1 e 6'; END IF;

  v_venc := COALESCE((p->>'primeiro_vencimento')::date, v_ini);
  IF v_venc < v_ini THEN RAISE EXCEPTION 'Primeiro vencimento não pode ser antes do início'; END IF;

  v_valor_c := round(c.valor * 100);
  IF v_ehmensal AND NOT v_ciclo THEN v_taxa_c := round(COALESCE(c.taxa_recorrencia, 0) * 100); END IF;
  IF jsonb_array_length(COALESCE(p->'servicos', '[]'::jsonb)) <> (
       SELECT count(*) FROM jsonb_array_elements_text(COALESCE(p->'servicos', '[]'::jsonb)) x(id)
       JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid AND sc.versao = 2027) THEN
    RAISE EXCEPTION 'Serviço 2027 não encontrado';
  END IF;
  SELECT COALESCE(sum(round(sc.valor * 100)), 0) INTO v_serv_c
  FROM jsonb_array_elements_text(COALESCE(p->'servicos', '[]'::jsonb)) x(id)
  JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid AND sc.versao = 2027;
  v_embutir := NOT v_ehmensal;
  v_mensal_c := v_valor_c + v_taxa_c;
  v_plano_total_c := CASE WHEN v_ciclo THEN v_mensal_c WHEN v_ehmensal THEN v_mensal_c * 12 ELSE v_valor_c END;

  v_meses := CASE WHEN v_ciclo THEN 1 WHEN v_pacote THEN c.periodo_meses ELSE 12 END;
  v_fim_plano := CASE WHEN v_ciclo THEN (v_ini + interval '1 month')::date WHEN v_pacote THEN (v_ini + make_interval(months => v_meses))::date ELSE (v_ini + interval '12 months')::date END;
  v_fim_ciclo := (v_ini + interval '1 month' - interval '1 day')::date;
  v_valid12 := (v_ini + interval '12 months')::date;
  v_freq := CASE WHEN c.frequencia::text = 'livre' THEN 5 ELSE NULLIF(regexp_replace(c.frequencia::text, '\D', '', 'g'), '')::smallint END;
  v_qtd := COALESCE(c.quantidade_creditos, 0);

  v_forma_venda := CASE v_forma WHEN 'recorrencia' THEN 'cartao_recorrencia' WHEN 'cartao_parcelado' THEN 'cartao_credito' ELSE 'pix' END;
  v_forma_contrato := CASE v_forma WHEN 'recorrencia' THEN 'cartao_recorrencia' WHEN 'cartao_parcelado' THEN 'cartao_parcelado' ELSE 'dinheiro' END;

  IF v_substituir THEN
    UPDATE public.contratos SET status = 'encerrado',
      observacoes = COALESCE(observacoes || ' | ', '') || 'Encerrado: substituído por venda 2027 em ' || CURRENT_DATE
    WHERE aluno_id = v_aluno AND status IN ('ativo','suspenso')
      AND plano_id IN (SELECT id FROM public.planos WHERE aluno_id = v_aluno AND ativo AND atividade = c.atividade);
    UPDATE public.planos SET ativo = false
    WHERE aluno_id = v_aluno AND ativo AND atividade = c.atividade;
  END IF;

  INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
    forma_pagamento, parcelas, vendedor_id, status_pagamento, observacoes, data_venda,
    tipo_cobranca, taxa_mensal, modalidade_pagamento, canal_pagamento, origem, idempotency_key)
  VALUES (v_aluno, 'plano', c.id, COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
    v_plano_total_c / 100.0, 0, v_plano_total_c / 100.0,
    v_forma_venda, v_n, v_uid, 'pendente', v_obs, v_ini,
    CASE WHEN v_forma = 'recorrencia' THEN 'recorrencia' ELSE 'tradicional' END,
    v_taxa_c / 100.0, v_forma, p_canal, v_origem, v_idem)
  RETURNING id INTO v_venda_id;

  INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade,
    data_fim, catalogo_id, plano_codigo, forma_pagamento_padrao, parcelas_padrao, renovacao_automatica, observacoes)
  VALUES (v_aluno, c.nome, v_ini, v_meses, v_plano_total_c / 100.0, true, ARRAY[]::text[], c.atividade,
    v_fim_plano, c.id, c.codigo, v_forma_venda, v_n, v_ciclo,
    CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_plano_id;
  UPDATE public.vendas SET plano_id = v_plano_id WHERE id = v_venda_id;
  IF v_ciclo THEN UPDATE public.planos SET proxima_renovacao = v_fim_plano WHERE id = v_plano_id; END IF;

  FOR s IN
    SELECT sc.*, x.ord FROM jsonb_array_elements_text(COALESCE(p->'servicos', '[]'::jsonb)) WITH ORDINALITY x(id, ord)
    JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid ORDER BY x.ord
  LOOP
    INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
      forma_pagamento, parcelas, vendedor_id, status_pagamento, data_venda, tipo_cobranca,
      modalidade_pagamento, canal_pagamento, origem, plano_id, idempotency_key)
    VALUES (v_aluno, 'servico', s.id, s.nome, s.valor, 0, s.valor,
      CASE WHEN v_embutir THEN v_forma_venda WHEN v_forma_s = 'pix_vista' THEN 'pix' ELSE 'cartao_credito' END,
      CASE WHEN v_embutir THEN v_n ELSE v_n_s END, v_uid, 'pendente', v_ini, 'tradicional',
      CASE WHEN v_embutir THEN v_forma ELSE v_forma_s END, p_canal, v_origem, v_plano_id,
      CASE WHEN v_idem IS NOT NULL THEN v_idem || ':s' || s.ord END)
    RETURNING id INTO v_sid;
    v_serv_ids := v_serv_ids || v_sid;
    v_serv_vendas := v_serv_vendas || jsonb_build_object('venda_id', v_sid, 'codigo', s.codigo, 'valor', s.valor);

    FOR v_comp IN SELECT * FROM jsonb_array_elements(COALESCE(s.composicao, jsonb_build_array(jsonb_build_object('atividade', s.atividade, 'quantidade', s.quantidade_sessoes))))
    LOOP
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
      VALUES (v_aluno, 'servico', v_sid, v_comp->>'atividade', (v_comp->>'quantidade')::int, false,
              (v_ini + make_interval(months => COALESCE(s.validade_meses, 12)))::date)
      RETURNING id INTO v_cred;
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
      VALUES (v_cred, 'compra', (v_comp->>'quantidade')::int, v_uid, 'Serviço 2027: ' || s.nome);
    END LOOP;
  END LOOP;

  DELETE FROM public.cobrancas WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano_id);
  DELETE FROM public.ciclos_credito WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano_id);
  DELETE FROM public.contratos WHERE plano_id = v_plano_id;

  v_total_c := v_plano_total_c + CASE WHEN v_embutir THEN v_serv_c ELSE 0 END;

  INSERT INTO public.contratos (aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, criado_por, servicos_inclusos, catalogo_id, observacoes)
  VALUES (v_aluno, v_plano_id, c.familia, v_freq, v_qtd,
    CASE WHEN v_ciclo THEN 'mensal' WHEN v_pacote AND v_meses = 4 THEN 'quadrimestral' WHEN v_pacote AND v_meses = 6 THEN 'semestral' ELSE 'anual' END, v_ini, v_fim_plano, v_forma_contrato,
    v_plano_total_c / 100.0, v_total_c / 100.0, v_taxa_c / 100.0,
    v_n, 'ativo', v_uid, jsonb_build_object('servicos_2027', v_serv_vendas), c.id,
    CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_contrato_id;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato_id, v_qtd, v_ini, CASE WHEN v_ciclo THEN v_fim_ciclo ELSE v_fim_plano END, 'ativo');

  IF p_sem_cobrancas THEN
    NULL; -- venda do site: cobranças espelho ficam para a fase B
  ELSIF v_ehmensal THEN
    FOR i IN 1..(CASE WHEN v_ciclo THEN 1 ELSE 12 END) LOOP
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, i, v_mensal_c / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        v_forma_venda, 'manual_admin', CASE WHEN v_ciclo THEN 'Mensalidade ciclo ' || to_char(v_ini, 'DD/MM/YYYY') ELSE 'Mensalidade ' || i || '/12' END || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
        jsonb_build_object('plano', v_mensal_c / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb));
    END LOOP;
  ELSE
    v_base := (v_plano_total_c + v_serv_c) / v_n;
    v_pbase := v_plano_total_c / v_n;
    FOR i IN 1..v_n LOOP
      v_parc := CASE WHEN i = v_n THEN (v_plano_total_c + v_serv_c) - v_base * (v_n - 1) ELSE v_base END;
      v_pparc := CASE WHEN i = v_n THEN v_plano_total_c - v_pbase * (v_n - 1) ELSE v_pbase END;
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, i, v_parc / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        v_forma_venda, 'manual_admin',
        'Parcela ' || i || '/' || v_n || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text
          || CASE WHEN v_serv_c > 0 THEN ' + serviços' ELSE '' END,
        jsonb_build_object('plano', v_pparc / 100.0, 'servicos', (v_parc - v_pparc) / 100.0, 'servicos_vendas', v_serv_vendas));
    END LOOP;
  END IF;

  IF NOT p_sem_cobrancas AND NOT v_embutir AND v_serv_c > 0 THEN
    v_base := v_serv_c / v_n_s;
    FOR i IN 1..v_n_s LOOP
      v_parc := CASE WHEN i = v_n_s THEN v_serv_c - v_base * (v_n_s - 1) ELSE v_base END;
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, 100 + i, v_parc / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        CASE WHEN v_forma_s = 'pix_vista' THEN 'pix' ELSE 'cartao_credito' END, 'manual_admin',
        'Serviços ' || i || '/' || v_n_s,
        jsonb_build_object('plano', 0, 'servicos', v_parc / 100.0, 'servicos_vendas', v_serv_vendas));
    END LOOP;
  END IF;

  IF v_cons THEN
    NULL; -- Consultoria Online: sem crédito de Treino
  ELSIF v_ehstart THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (v_aluno, 'plano', v_venda_id, 'Treino', v_qtd, COALESCE(c.ilimitado, false), v_fim_ciclo, v_ini, 0)
    RETURNING id INTO v_cred;
  ELSE
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, reposicao_pct)
    VALUES (v_aluno, 'plano', v_venda_id, 'Treino', v_qtd, COALESCE(c.ilimitado, false), v_valid12,
      CASE WHEN COALESCE(c.ilimitado, false) THEN 0 ELSE COALESCE(c.reposicao_saldo_pct, 0) END)
    RETURNING id INTO v_cred;
  END IF;
  IF NOT v_cons THEN
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (v_cred, 'compra', v_qtd, v_uid, 'Plano 2027: ' || c.codigo);
  END IF;

  k := 0;
  FOR m IN SELECT unnest(COALESCE(c.avaliacoes_funcionais_meses, '{}'::int[])) LOOP
    k := k + 1;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (v_aluno, 'plano', CASE WHEN k = 1 THEN v_venda_id ELSE v_plano_id END, 'Avaliação Funcional', 1, false,
      v_valid12, (v_ini + make_interval(months => m - 1))::date, 0)
    RETURNING id INTO v_cred;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (v_cred, 'compra', 1, v_uid, 'Avaliação Funcional ' || m || 'º mês — ' || c.codigo);
  END LOOP;

  IF COALESCE(c.bota_compressao_mes, 0) > 0 THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (v_aluno, 'plano', v_venda_id, 'Bota de compressão', c.bota_compressao_mes, false, v_fim_ciclo, v_ini, 0)
    RETURNING id INTO v_cred;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (v_cred, 'compra', c.bota_compressao_mes, v_uid, 'Bota de compressão — ' || c.codigo);
  END IF;

  RETURN jsonb_build_object('venda_id', v_venda_id, 'plano_id', v_plano_id, 'contrato_id', v_contrato_id,
    'servico_venda_ids', to_jsonb(v_serv_ids), 'teste', v_teste);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_venda_2027_criar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_teste boolean;
  v_desc_c bigint := round(COALESCE((p->>'desconto')::numeric, 0) * 100);
  v_rec boolean := COALESCE((p->>'desconto_recorrente')::boolean, false);
  r jsonb; c record; v_venda uuid; v_plano uuid; v_contrato uuid;
  v_ehstart boolean; v_ehmensal boolean; v_ciclo boolean; v_plano_c bigint; v_novo_c bigint; v_serv_c bigint; v_n int;
  v_base bigint; v_pbase bigint; v_parc bigint; v_pparc bigint; cb record; i int := 0;
BEGIN
  IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, 'coordenador'::app_role) OR public.has_role(v_uid, 'professor'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para vender planos 2027';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  IF v_desc_c < 0 THEN RAISE EXCEPTION 'Desconto inválido'; END IF;
  v_teste := EXISTS (
    SELECT 1 FROM public.sistema_config sc
    WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
      AND jsonb_typeof(sc.valor) = 'array'
      AND sc.valor ? v_aluno::text
  );
  r := public.fn_venda_2027_gravar(p, v_uid, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END, 'manual', false);
  IF v_desc_c = 0 OR COALESCE((r->>'repetida')::boolean, false) THEN RETURN r; END IF;

  v_venda := (r->>'venda_id')::uuid; v_plano := (r->>'plano_id')::uuid; v_contrato := (r->>'contrato_id')::uuid;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid;
  v_ehstart := c.familia = 'start_2027';
  v_ehmensal := c.modalidade_cobranca = 'recorrencia_mensal';
  v_ciclo := v_ehstart OR (c.familia = 'consultoria_2027' AND v_ehmensal);

  IF v_ehmensal THEN
    SELECT * INTO cb FROM public.cobrancas WHERE contrato_id = v_contrato AND numero_ciclo = 1;
    IF v_desc_c >= round(cb.valor * 100) THEN RAISE EXCEPTION 'Desconto maior que a mensalidade'; END IF;
    UPDATE public.cobrancas SET valor = (round(cb.valor * 100) - v_desc_c) / 100.0,
      composicao = jsonb_set(COALESCE(composicao, '{}'::jsonb), '{plano}', to_jsonb((round(cb.valor * 100) - v_desc_c) / 100.0))
    WHERE id = cb.id;
    IF v_ciclo AND v_rec THEN
      UPDATE public.planos SET desconto_recorrente = v_desc_c / 100.0 WHERE id = v_plano;
    END IF;
  ELSE
    SELECT round(valor_base * 100), round(valor_cobrado * 100) - round(valor_base * 100), parcelas
      INTO v_plano_c, v_serv_c, v_n FROM public.contratos WHERE id = v_contrato;
    IF v_desc_c >= v_plano_c THEN RAISE EXCEPTION 'Desconto maior que o valor do plano'; END IF;
    v_novo_c := v_plano_c - v_desc_c;
    v_base := (v_novo_c + v_serv_c) / v_n;
    v_pbase := v_novo_c / v_n;
    FOR cb IN SELECT * FROM public.cobrancas WHERE contrato_id = v_contrato AND numero_ciclo BETWEEN 1 AND v_n ORDER BY numero_ciclo LOOP
      i := cb.numero_ciclo;
      v_parc := CASE WHEN i = v_n THEN (v_novo_c + v_serv_c) - v_base * (v_n - 1) ELSE v_base END;
      v_pparc := CASE WHEN i = v_n THEN v_novo_c - v_pbase * (v_n - 1) ELSE v_pbase END;
      UPDATE public.cobrancas SET valor = v_parc / 100.0,
        composicao = jsonb_set(jsonb_set(COALESCE(composicao, '{}'::jsonb), '{plano}', to_jsonb(v_pparc / 100.0)), '{servicos}', to_jsonb((v_parc - v_pparc) / 100.0))
      WHERE id = cb.id;
    END LOOP;
  END IF;

  UPDATE public.vendas SET desconto = v_desc_c / 100.0, valor_final = valor - v_desc_c / 100.0 WHERE id = v_venda;
  UPDATE public.contratos SET valor_cobrado = valor_cobrado - v_desc_c / 100.0 WHERE id = v_contrato;
  RETURN r || jsonb_build_object('desconto', v_desc_c / 100.0, 'desconto_recorrente', v_ciclo AND v_rec);
END;
$function$
;

REVOKE ALL ON FUNCTION public.fn_venda_2027_gravar(jsonb, uuid, boolean, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_venda_2027_gravar(jsonb, uuid, boolean, text, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.fn_venda_2027_criar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_2027_criar(jsonb) TO authenticated, service_role;
