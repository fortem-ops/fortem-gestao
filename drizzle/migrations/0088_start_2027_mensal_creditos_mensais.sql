-- 3B.1: Start 2027 vira ciclo mensal (1 cobrança, renovação automática)
DO $do$
DECLARE src text; a text[]; b text[]; i int;
BEGIN
  SELECT pg_get_functiondef('public.fn_venda_2027_criar(jsonb)'::regprocedure) INTO src;
  a := ARRAY[
    'IF v_forma = ''recorrencia'' THEN v_n := 12; END IF;',
    'v_plano_total_c := CASE WHEN v_ehmensal THEN v_mensal_c * 12 ELSE v_valor_c END;',
    'v_fim_plano := (v_ini + interval ''12 months'')::date;',
    'VALUES (v_aluno, c.nome, v_ini, 12, v_plano_total_c / 100.0, true, ARRAY[]::text[], ''treinamento_funcional'',
    v_fim_plano, c.id, c.codigo, v_forma_venda, v_n, false,',
    'UPDATE public.vendas SET plano_id = v_plano_id WHERE id = v_venda_id;',
    'FOR i IN 1..12 LOOP',
    '''Mensalidade '' || i || ''/12 — '''
  ];
  b := ARRAY[
    'IF v_forma = ''recorrencia'' THEN v_n := CASE WHEN v_ehstart THEN 1 ELSE 12 END; END IF;',
    'v_plano_total_c := CASE WHEN v_ehstart THEN v_mensal_c WHEN v_ehmensal THEN v_mensal_c * 12 ELSE v_valor_c END;',
    'v_fim_plano := CASE WHEN v_ehstart THEN (v_ini + interval ''1 month'')::date ELSE (v_ini + interval ''12 months'')::date END;',
    'VALUES (v_aluno, c.nome, v_ini, CASE WHEN v_ehstart THEN 1 ELSE 12 END, v_plano_total_c / 100.0, true, ARRAY[]::text[], ''treinamento_funcional'',
    v_fim_plano, c.id, c.codigo, v_forma_venda, v_n, v_ehstart,',
    'UPDATE public.vendas SET plano_id = v_plano_id WHERE id = v_venda_id;
  IF v_ehstart THEN UPDATE public.planos SET proxima_renovacao = v_fim_plano WHERE id = v_plano_id; END IF;',
    'FOR i IN 1..(CASE WHEN v_ehstart THEN 1 ELSE 12 END) LOOP',
    'CASE WHEN v_ehstart THEN ''Mensalidade ciclo '' || to_char(v_ini, ''DD/MM/YYYY'') ELSE ''Mensalidade '' || i || ''/12'' END || '' — '''
  ];
  FOR i IN 1..array_length(a, 1) LOOP
    IF position(a[i] IN src) = 0 THEN RAISE EXCEPTION 'trecho % não encontrado', i; END IF;
    src := replace(src, a[i], b[i]);
  END LOOP;
  EXECUTE src;
END
$do$;

CREATE OR REPLACE FUNCTION public.fn_renovar_start_2027(p_plano uuid, p_data date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  pl public.planos%ROWTYPE;
  k public.contratos%ROWTYPE;
  c public.planos_catalogo%ROWTYPE;
  v_ini date; v_fim date; v_idem text; v_teste boolean;
  v_venda uuid; v_plano uuid; v_contrato uuid;
BEGIN
  SELECT * INTO pl FROM public.planos WHERE id = p_plano FOR UPDATE;
  IF NOT FOUND OR NOT pl.ativo OR NOT COALESCE(pl.renovacao_automatica, false) THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'plano inativo ou sem renovação automática');
  END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = pl.catalogo_id AND familia = 'start_2027';
  IF NOT FOUND THEN RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'não é Start 2027'); END IF;
  IF pl.proxima_renovacao IS NULL OR pl.proxima_renovacao > p_data THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'ciclo ainda não terminou');
  END IF;
  IF EXISTS (SELECT 1 FROM public.planos n WHERE n.aluno_id = pl.aluno_id AND n.ativo AND n.atividade = pl.atividade
             AND n.id <> pl.id AND n.created_at > pl.created_at) THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'aluno tem plano mais novo');
  END IF;

  v_ini := pl.proxima_renovacao;
  v_fim := (v_ini + interval '1 month')::date;
  v_idem := 'renov2027:' || pl.id || ':' || v_ini;
  IF EXISTS (SELECT 1 FROM public.vendas WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'renovação já feita');
  END IF;

  SELECT * INTO k FROM public.contratos WHERE plano_id = pl.id ORDER BY created_at DESC LIMIT 1;
  v_teste := EXISTS (SELECT 1 FROM public.sistema_config sc WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
                     AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? pl.aluno_id::text);

  UPDATE public.planos SET ativo = false WHERE id = pl.id;
  UPDATE public.contratos SET status = 'encerrado',
    observacoes = COALESCE(observacoes || ' | ', '') || 'Encerrado: renovado em ' || v_ini
  WHERE plano_id = pl.id AND status IN ('ativo', 'suspenso');

  INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
    forma_pagamento, parcelas, status_pagamento, data_venda, tipo_cobranca, taxa_mensal,
    modalidade_pagamento, canal_pagamento, origem, idempotency_key, plano_id)
  VALUES (pl.aluno_id, 'plano', c.id, COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text || ' (renovação automática)',
    pl.valor, 0, pl.valor, pl.forma_pagamento_padrao, 1, 'pendente', v_ini, 'recorrencia', 0,
    'recorrencia', 'manual', CASE WHEN v_teste THEN 'teste_2027' ELSE 'renovacao_automatica' END, v_idem, NULL)
  RETURNING id INTO v_venda;

  INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade,
    data_fim, catalogo_id, plano_codigo, forma_pagamento_padrao, parcelas_padrao, renovacao_automatica, observacoes)
  VALUES (pl.aluno_id, pl.tipo, v_ini, 1, pl.valor, true, ARRAY[]::text[], pl.atividade,
    v_fim, c.id, c.codigo, pl.forma_pagamento_padrao, 1, true, pl.observacoes)
  RETURNING id INTO v_plano;
  UPDATE public.vendas SET plano_id = v_plano WHERE id = v_venda;
  UPDATE public.planos SET proxima_renovacao = v_fim WHERE id = v_plano;

  DELETE FROM public.cobrancas WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano);
  DELETE FROM public.ciclos_credito WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano);
  DELETE FROM public.contratos WHERE plano_id = v_plano;

  INSERT INTO public.contratos (aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, criado_por, servicos_inclusos, catalogo_id, observacoes)
  VALUES (pl.aluno_id, v_plano, c.familia, k.frequencia_semanal, COALESCE(c.quantidade_creditos, 0),
    'mensal', v_ini, v_fim, COALESCE(k.forma_pagamento, 'cartao_recorrencia'), pl.valor, pl.valor, 0,
    1, 'ativo', k.criado_por, '{}'::jsonb, c.id, CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_contrato;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato, COALESCE(c.quantidade_creditos, 0), v_ini, (v_fim - 1), 'ativo');

  INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
    forma_pagamento, meio_registro, descricao, composicao)
  VALUES (v_contrato, pl.aluno_id, 1, pl.valor, v_ini, 'pendente', pl.forma_pagamento_padrao, 'manual_admin',
    'Mensalidade ciclo ' || to_char(v_ini, 'DD/MM/YYYY') || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
    jsonb_build_object('plano', pl.valor, 'servicos', 0, 'servicos_vendas', '[]'::jsonb));

  RETURN jsonb_build_object('plano_anterior', pl.id, 'plano_id', v_plano, 'venda_id', v_venda,
    'contrato_id', v_contrato, 'ciclo_inicio', v_ini, 'ciclo_fim', v_fim - 1);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_creditos_mensais_2027(p_data date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tol int;
  r record; cb record;
  v_i int; v_comp date; v_valid date; v_cred uuid;
  n_start int := 0; n_bota int := 0; n_aguardando int := 0; n_logs int := 0;
BEGIN
  SELECT NULLIF(sc.valor #>> '{}', '')::int INTO v_tol FROM public.sistema_config sc WHERE sc.chave = 'creditos_2027_tolerancia_dias';
  v_tol := COALESCE(v_tol, 3);

  FOR r IN
    SELECT p.id AS plano_id, p.aluno_id, p.data_inicio, v.id AS venda_id, c.quantidade_creditos, c.ilimitado, c.codigo
    FROM public.planos p
    JOIN public.planos_catalogo c ON c.id = p.catalogo_id AND c.familia = 'start_2027'
    JOIN LATERAL (SELECT id FROM public.vendas WHERE plano_id = p.id AND tipo = 'plano' ORDER BY created_at LIMIT 1) v ON true
    WHERE p.ativo AND p.data_inicio <= p_data
  LOOP
    IF EXISTS (SELECT 1 FROM public.creditos_aluno WHERE origem_id = r.venda_id AND atividade = 'Treino' AND competencia = r.data_inicio) THEN
      CONTINUE;
    END IF;
    cb := NULL;
    SELECT x.status, x.data_vencimento INTO cb FROM public.cobrancas x JOIN public.contratos k ON k.id = x.contrato_id
    WHERE k.plano_id = r.plano_id AND x.numero_ciclo = 1 ORDER BY x.created_at DESC LIMIT 1;
    IF cb.status IS NULL OR NOT (cb.status = 'pago' OR p_data <= cb.data_vencimento + v_tol) THEN
      n_aguardando := n_aguardando + 1;
      CONTINUE;
    END IF;
    v_valid := (r.data_inicio + interval '1 month' - interval '1 day')::date;
    v_cred := NULL;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (r.aluno_id, 'plano', r.venda_id, 'Treino', COALESCE(r.quantidade_creditos, 0), COALESCE(r.ilimitado, false),
      v_valid, r.data_inicio, 0)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
    IF v_cred IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
      VALUES (v_cred, 'compra', COALESCE(r.quantidade_creditos, 0), 'Ciclo mensal 2027: ' || r.codigo
        || CASE WHEN cb.status <> 'pago' THEN ' (provisório, mensalidade em aberto)' ELSE '' END);
      n_start := n_start + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT p.id AS plano_id, p.aluno_id, p.data_inicio, v.id AS venda_id, c.bota_compressao_mes AS qtd, c.codigo,
           k.forma_pagamento, k.id AS contrato_id
    FROM public.planos p
    JOIN public.planos_catalogo c ON c.id = p.catalogo_id AND c.familia = 'pro_2027' AND COALESCE(c.bota_compressao_mes, 0) > 0
    JOIN LATERAL (SELECT id FROM public.vendas WHERE plano_id = p.id AND tipo = 'plano' ORDER BY created_at LIMIT 1) v ON true
    JOIN LATERAL (SELECT id, forma_pagamento FROM public.contratos WHERE plano_id = p.id AND status = 'ativo' ORDER BY created_at DESC LIMIT 1) k ON true
    WHERE p.ativo AND p.data_inicio <= p_data
  LOOP
    v_i := (extract(year FROM age(p_data, r.data_inicio)) * 12 + extract(month FROM age(p_data, r.data_inicio)))::int;
    IF v_i < 0 OR v_i > 11 THEN CONTINUE; END IF;
    v_comp := (r.data_inicio + make_interval(months => v_i))::date;
    IF EXISTS (SELECT 1 FROM public.creditos_aluno WHERE origem_id = r.venda_id AND atividade = 'Bota de compressão' AND competencia = v_comp) THEN
      CONTINUE;
    END IF;
    IF r.forma_pagamento = 'cartao_recorrencia' THEN
      cb := NULL;
      SELECT x.status, x.data_vencimento INTO cb FROM public.cobrancas x
      WHERE x.contrato_id = r.contrato_id AND x.numero_ciclo = v_i + 1 LIMIT 1;
      IF cb.status IS NULL OR NOT (cb.status = 'pago' OR p_data <= cb.data_vencimento + v_tol) THEN
        n_aguardando := n_aguardando + 1;
        CONTINUE;
      END IF;
    END IF;
    v_valid := (r.data_inicio + make_interval(months => v_i + 1) - interval '1 day')::date;
    v_cred := NULL;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (r.aluno_id, 'plano', r.venda_id, 'Bota de compressão', r.qtd, false, v_valid, v_comp, 0)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
    IF v_cred IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
      VALUES (v_cred, 'compra', r.qtd, 'Bota de compressão ciclo ' || (v_i + 1) || '/12 — ' || r.codigo);
      n_bota := n_bota + 1;
    END IF;
  END LOOP;

  FOR cb IN
    SELECT x.id, x.aluno_id, x.numero_ciclo, x.valor, x.data_vencimento, pc.codigo
    FROM public.cobrancas x
    JOIN public.contratos k ON k.id = x.contrato_id AND k.status = 'ativo' AND k.forma_pagamento = 'cartao_recorrencia'
    JOIN public.planos_catalogo pc ON pc.id = k.catalogo_id AND pc.versao = 2027
    WHERE x.numero_ciclo < 100 AND x.status IN ('pendente', 'atrasado') AND x.data_vencimento + v_tol < p_data
      AND NOT EXISTS (SELECT 1 FROM public.system_logs l WHERE l.modulo = 'creditos_2027'
                      AND l.acao = 'mensalidade_fora_tolerancia' AND l.payload->>'cobranca_id' = x.id::text)
  LOOP
    INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
    VALUES ('creditos_2027', 'mensalidade_fora_tolerancia',
      'Mensalidade 2027 sem pagamento após ' || v_tol || ' dias de tolerância (' || cb.codigo || ', ciclo ' || cb.numero_ciclo || ')',
      jsonb_build_object('cobranca_id', cb.id, 'aluno_id', cb.aluno_id, 'vencimento', cb.data_vencimento, 'valor', cb.valor));
    n_logs := n_logs + 1;
  END LOOP;

  RETURN jsonb_build_object('data', p_data, 'tolerancia_dias', v_tol, 'start_liberados', n_start,
    'bota_liberados', n_bota, 'aguardando_pagamento', n_aguardando, 'avisos_gravados', n_logs);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_renovar_start_2027(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_creditos_mensais_2027(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_renovar_start_2027(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_creditos_mensais_2027(date) TO service_role;