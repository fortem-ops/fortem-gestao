ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS composicao jsonb;
COMMENT ON COLUMN public.cobrancas.composicao IS 'Planos 2027: divisão da parcela entre plano e serviços ({plano, servicos, servicos_vendas[]}). Nula no legado.';

CREATE OR REPLACE FUNCTION public.fn_venda_2027_criar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
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
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Somente administradores podem vender planos 2027';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;

  IF v_idem IS NOT NULL THEN
    SELECT id INTO v_existente FROM public.vendas WHERE idempotency_key = v_idem AND tipo = 'plano' LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('venda_id', v_existente, 'repetida', true);
    END IF;
  END IF;

  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid AND versao = 2027;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item 2027 não encontrado'; END IF;

  v_teste := EXISTS (
    SELECT 1 FROM public.sistema_config sc
    WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
      AND jsonb_typeof(sc.valor) = 'array'
      AND sc.valor ? v_aluno::text
  );
  v_origem := CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END;

  IF NOT v_teste AND NOT (c.ativo AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= CURRENT_DATE)
                          AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Plano 2027 ainda não liberado para venda';
  END IF;

  v_ehstart := c.familia = 'start_2027';
  v_ehmensal := c.modalidade_cobranca = 'recorrencia_mensal';

  IF v_ehstart AND NOT v_ehmensal THEN RAISE EXCEPTION 'Start 2027 é só recorrência mensal'; END IF;
  IF v_ehmensal AND v_forma <> 'recorrencia' THEN RAISE EXCEPTION 'Item mensal só pode ser vendido em recorrência'; END IF;
  IF NOT v_ehmensal AND v_forma NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF v_forma = 'cartao_parcelado' AND (v_n < 1 OR v_n > 12) THEN RAISE EXCEPTION 'Parcelas devem ser entre 1 e 12'; END IF;
  IF v_forma = 'pix_vista' THEN v_n := 1; END IF;
  IF v_forma = 'recorrencia' THEN v_n := 12; END IF;
  IF v_forma_s NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento dos serviços inválida'; END IF;
  IF v_forma_s = 'pix_vista' THEN v_n_s := 1; END IF;
  IF v_n_s < 1 OR v_n_s > 6 THEN RAISE EXCEPTION 'Parcelas dos serviços devem ser entre 1 e 6'; END IF;

  v_venc := COALESCE((p->>'primeiro_vencimento')::date, v_ini);
  IF v_venc < v_ini THEN RAISE EXCEPTION 'Primeiro vencimento não pode ser antes do início'; END IF;

  -- Valores (centavos), mesma regra de calcularVenda2027
  v_valor_c := round(c.valor * 100);
  IF v_ehmensal AND NOT v_ehstart THEN v_taxa_c := round(COALESCE(c.taxa_recorrencia, 0) * 100); END IF;
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
  v_plano_total_c := CASE WHEN v_ehmensal THEN v_mensal_c * 12 ELSE v_valor_c END;

  v_fim_plano := (v_ini + interval '12 months')::date;
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
      AND plano_id IN (SELECT id FROM public.planos WHERE aluno_id = v_aluno AND ativo AND atividade = 'treinamento_funcional');
    UPDATE public.planos SET ativo = false
    WHERE aluno_id = v_aluno AND ativo AND atividade = 'treinamento_funcional';
  END IF;

  INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
    forma_pagamento, parcelas, vendedor_id, status_pagamento, observacoes, data_venda,
    tipo_cobranca, taxa_mensal, modalidade_pagamento, canal_pagamento, origem, idempotency_key)
  VALUES (v_aluno, 'plano', c.id, COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
    v_plano_total_c / 100.0, 0, v_plano_total_c / 100.0,
    v_forma_venda, v_n, v_uid, 'pendente', v_obs, v_ini,
    CASE WHEN v_forma = 'recorrencia' THEN 'recorrencia' ELSE 'tradicional' END,
    v_taxa_c / 100.0, v_forma, 'manual', v_origem, v_idem)
  RETURNING id INTO v_venda_id;

  INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade,
    data_fim, catalogo_id, plano_codigo, forma_pagamento_padrao, parcelas_padrao, renovacao_automatica, observacoes)
  VALUES (v_aluno, c.nome, v_ini, 12, v_plano_total_c / 100.0, true, ARRAY[]::text[], 'treinamento_funcional',
    v_fim_plano, c.id, c.codigo, v_forma_venda, v_n, false,
    CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_plano_id;
  UPDATE public.vendas SET plano_id = v_plano_id WHERE id = v_venda_id;

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
      CASE WHEN v_embutir THEN v_forma ELSE v_forma_s END, 'manual', v_origem, v_plano_id,
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
    CASE WHEN v_ehstart THEN 'mensal' ELSE 'anual' END, v_ini, v_fim_plano, v_forma_contrato,
    v_plano_total_c / 100.0, v_total_c / 100.0, v_taxa_c / 100.0,
    v_n, 'ativo', v_uid, jsonb_build_object('servicos_2027', v_serv_vendas), c.id,
    CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_contrato_id;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato_id, v_qtd, v_ini, CASE WHEN v_ehstart THEN v_fim_ciclo ELSE v_fim_plano END, 'ativo');

  IF v_ehmensal THEN
    FOR i IN 1..12 LOOP
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, i, v_mensal_c / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        v_forma_venda, 'manual_admin', 'Mensalidade ' || i || '/12 — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
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

  IF NOT v_embutir AND v_serv_c > 0 THEN
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

  IF v_ehstart THEN
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
  INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
  VALUES (v_cred, 'compra', v_qtd, v_uid, 'Plano 2027: ' || c.codigo);

  k := 0;
  FOR m IN SELECT jsonb_array_elements_text(COALESCE(c.avaliacoes_funcionais_meses, '[]'::jsonb))::int LOOP
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
$fn$;

REVOKE ALL ON FUNCTION public.fn_venda_2027_criar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_venda_2027_criar(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_processar_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $pv$
DECLARE
  _cat_plano record;
  _cat_serv record;
  _novo_plano_id uuid;
  _credito_id uuid;
  _qtd int;
  _ilim bool;
  _valor_plano numeric;
  _freq_sem smallint;
BEGIN
  IF NEW.status_pagamento = 'cancelado' THEN
    RETURN NEW;
  END IF;

  -- Planos/serviços 2027: tudo é criado por fn_venda_2027_criar (legado segue abaixo sem mudança).
  IF NEW.catalogo_id IS NOT NULL AND (
       (NEW.tipo = 'plano' AND EXISTS (SELECT 1 FROM public.planos_catalogo c WHERE c.id = NEW.catalogo_id AND c.versao = 2027))
    OR (NEW.tipo = 'servico' AND EXISTS (SELECT 1 FROM public.servicos_catalogo s WHERE s.id = NEW.catalogo_id AND s.versao = 2027))
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'plano' THEN
    SELECT * INTO _cat_plano FROM public.planos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_plano IS NULL THEN RAISE EXCEPTION 'Plano de catálogo não encontrado'; END IF;

    _valor_plano := COALESCE(NEW.valor_final, NEW.valor, _cat_plano.valor);

    IF NEW.plano_id IS NULL THEN
      INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade)
      VALUES (NEW.aluno_id, _cat_plano.nome, NEW.data_venda, _cat_plano.periodo_meses, _valor_plano, true, ARRAY[]::text[], _cat_plano.atividade)
      RETURNING id INTO _novo_plano_id;

      NEW.plano_id := _novo_plano_id;
    END IF;

    _qtd := COALESCE(_cat_plano.quantidade_creditos, 0);
    _ilim := _cat_plano.ilimitado;

    SELECT id INTO _credito_id
    FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id
      AND atividade = 'Treino'
      AND origem_tipo = 'plano'
      AND origem_id = NEW.id
      AND ativo = true
    LIMIT 1;

    IF _credito_id IS NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
      VALUES (NEW.aluno_id, 'plano', NEW.id, 'Treino', _qtd, _ilim,
              (NEW.data_venda + (_cat_plano.periodo_meses || ' months')::interval)::date)
      RETURNING id INTO _credito_id;

      IF _credito_id IS NOT NULL THEN
        INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
        VALUES (_credito_id, 'compra', _qtd, NEW.vendedor_id, 'Plano: ' || _cat_plano.nome);
      END IF;
    END IF;

    -- Fonte oficial dos "créditos previstos" do contrato: o pacote realmente vendido.
    -- O gatilho fn_auto_criar_contrato_ciclo cria o contrato com frequência do cadastro x 4;
    -- aqui o valor é sobrescrito pelo que consta no catálogo da venda.
    IF COALESCE(_cat_plano.atividade, '') <> 'corrida' AND NEW.plano_id IS NOT NULL THEN
      _freq_sem := CASE
        WHEN COALESCE(_cat_plano.frequencia::text, '') = 'livre' THEN 5
        WHEN COALESCE(_cat_plano.frequencia::text, '') ~ '^[0-9]+x?$'
          THEN COALESCE(NULLIF(regexp_replace(_cat_plano.frequencia::text, '\D', '', 'g'), '')::smallint, 1)
        ELSE NULL
      END;
      IF _freq_sem IS NOT NULL AND _freq_sem NOT IN (1,2,3,5) THEN _freq_sem := NULL; END IF;

      UPDATE public.contratos
      SET creditos_total = _qtd,
          frequencia_semanal = COALESCE(_freq_sem, frequencia_semanal)
      WHERE plano_id = NEW.plano_id;

      UPDATE public.ciclos_credito
      SET creditos_liberados = _qtd
      WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = NEW.plano_id);
    END IF;

  ELSIF NEW.tipo = 'servico' THEN
    SELECT * INTO _cat_serv FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_serv IS NULL THEN RAISE EXCEPTION 'Serviço de catálogo não encontrado'; END IF;

    SELECT id INTO _credito_id
    FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id
      AND atividade = _cat_serv.atividade
      AND origem_tipo = 'servico'
      AND origem_id = NEW.id
      AND ativo = true
    LIMIT 1;

    IF _credito_id IS NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
      VALUES (NEW.aluno_id, 'servico', NEW.id, _cat_serv.atividade, _cat_serv.quantidade_sessoes, false)
      RETURNING id INTO _credito_id;

      IF _credito_id IS NOT NULL THEN
        INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
        VALUES (_credito_id, 'compra', _cat_serv.quantidade_sessoes, NEW.vendedor_id, 'Serviço: ' || _cat_serv.nome);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$pv$;