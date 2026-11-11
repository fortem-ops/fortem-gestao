-- Plano Semestral, Etapa 4: renovação mensal (ciclos de 30 dias) e cobrança no cartão.
-- Caminho dedicado: um único contrato/plano por venda; cada ciclo pago estende a vigência.
-- Start/Power/Pro 2027 e planos atuais não mudam (patches só acrescentam um ramo para semestral_2027).

CREATE OR REPLACE FUNCTION public.fn_semestral_valor_ciclo(p_contrato uuid, p_n int)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; v_fixo int; v_venda numeric;
BEGIN
  SELECT * INTO k FROM public.contratos WHERE id = p_contrato;
  SELECT preco_fixo_ciclos INTO v_fixo FROM public.planos_catalogo WHERE id = k.catalogo_id;
  SELECT valor_final INTO v_venda FROM public.vendas WHERE plano_id = k.plano_id AND tipo = 'plano' ORDER BY created_at LIMIT 1;
  IF p_n <= COALESCE(v_fixo, 0) AND v_venda IS NOT NULL THEN RETURN v_venda; END IF;
  RETURN k.valor_cobrado;
END $$;

CREATE OR REPLACE FUNCTION public.fn_semestral_gerar_mensalidade(p_venda uuid, p_token uuid, p_n int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; v_venc date; v_valor int; v_cob uuid; v_id uuid;
BEGIN
  SELECT kk.* INTO k FROM public.contratos kk JOIN public.vendas v ON v.plano_id = kk.plano_id AND v.id = p_venda
   WHERE kk.plano_tipo = 'semestral_2027' FOR UPDATE OF kk;
  IF k.id IS NULL OR k.status <> 'ativo' OR k.data_cancelamento IS NOT NULL OR p_n < 2 THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = p_n)
     OR EXISTS (SELECT 1 FROM public.planos_2027_mensalidades WHERE venda_origem_id = p_venda AND numero = p_n) THEN
    RETURN NULL;
  END IF;
  v_venc := k.data_inicio + 30 * (p_n - 1);
  v_valor := round(public.fn_semestral_valor_ciclo(k.id, p_n) * 100)::int;
  INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento, meio_registro, descricao, composicao)
  VALUES (k.id, k.aluno_id, p_n, v_valor / 100.0, v_venc, 'pendente', 'cartao_recorrencia', 'automatico',
    'Mensalidade ' || p_n || ' — Plano Semestral, recorrência automática no cartão',
    jsonb_build_object('plano', v_valor / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb))
  RETURNING id INTO v_cob;
  -- competencia = vencimento: ciclos de 30 dias podem cair duas vezes no mesmo mês.
  INSERT INTO public.planos_2027_mensalidades (venda_origem_id, tokenizacao_id, contrato_id, cobranca_id, numero, competencia, vencimento, valor_centavos, simulado)
  VALUES (p_venda, p_token, k.id, v_cob, p_n, v_venc, v_venc, v_valor, false)
  RETURNING id INTO v_id;
  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'mensalidade_gerada', 'Plano Semestral: mensalidade ' || p_n || ' gerada',
    jsonb_build_object('venda_id', p_venda, 'contrato_id', k.id, 'numero', p_n, 'vencimento', v_venc, 'valor_centavos', v_valor));
  RETURN v_id;
END $$;

DO $mig$
DECLARE s text; a text; b text;
BEGIN
  s := pg_get_functiondef('public.fn_mensalidade_manual_gerar(uuid)'::regprocedure);
  a := E'  IF k.plano_tipo IN (''start_2027'', ''consultoria_2027'') THEN\n';
  b := E'  IF k.plano_tipo = ''semestral_2027'' THEN\n    v_cob := public.fn_semestral_gerar_mensalidade(v.id, t.id, 2);\n    v_qtd := CASE WHEN v_cob IS NULL THEN 0 ELSE 1 END;\n  ELSIF k.plano_tipo IN (''start_2027'', ''consultoria_2027'') THEN\n';
  IF (length(s) - length(replace(s, a, ''))) / length(a) <> 1 THEN RAISE EXCEPTION 'trecho não encontrado em fn_mensalidade_manual_gerar'; END IF;
  EXECUTE replace(s, a, b);

  s := pg_get_functiondef('public.fn_mensalidade_manual_proximo(uuid)'::regprocedure);
  a := E'  SELECT * INTO k FROM contratos WHERE id = u.contrato_id;\n';
  b := a || E'  IF k.plano_tipo = ''semestral_2027'' THEN RETURN public.fn_semestral_gerar_mensalidade(p_venda_origem, u.tokenizacao_id, u.numero + 1); END IF;\n';
  IF (length(s) - length(replace(s, a, ''))) / length(a) <> 1 THEN RAISE EXCEPTION 'trecho não encontrado em fn_mensalidade_manual_proximo'; END IF;
  EXECUTE replace(s, a, b);
END $mig$;

CREATE OR REPLACE FUNCTION public.fn_semestral_liberar_ciclo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; c public.planos_catalogo; v_venda uuid; v_ini date; v_fim date; v_cred uuid; n int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago' OR OLD.status = 'pago' OR NEW.numero_ciclo IS NULL OR NEW.numero_ciclo >= 100 THEN RETURN NEW; END IF;
  SELECT * INTO k FROM public.contratos WHERE id = NEW.contrato_id;
  IF k.plano_tipo IS DISTINCT FROM 'semestral_2027' THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = k.catalogo_id;
  SELECT id INTO v_venda FROM public.vendas WHERE plano_id = k.plano_id AND tipo = 'plano' ORDER BY created_at LIMIT 1;
  IF v_venda IS NULL THEN RETURN NEW; END IF;
  n := NEW.numero_ciclo;
  v_ini := k.data_inicio + 30 * (n - 1);
  v_fim := v_ini + 29;
  INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade, competencia, reposicao_pct)
  VALUES (k.aluno_id, 'plano', v_venda, 'Treino', COALESCE(c.quantidade_creditos, 0), false, v_fim, v_ini, 0)
  ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
  IF v_cred IS NOT NULL THEN
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
    VALUES (v_cred, 'compra', COALESCE(c.quantidade_creditos, 0), 'Plano Semestral ciclo ' || n || ' (pago): ' || c.codigo);
  END IF;
  IF COALESCE(c.bota_compressao_mes, 0) > 0 THEN
    v_cred := NULL;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade, competencia, reposicao_pct)
    VALUES (k.aluno_id, 'plano', v_venda, 'Recovery (Bota de Compressão)', c.bota_compressao_mes, false, v_fim, v_ini, 0)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
    IF v_cred IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
      VALUES (v_cred, 'compra', c.bota_compressao_mes, 'Bota de compressão Semestral ciclo ' || n || ' — ' || c.codigo);
    END IF;
  END IF;
  IF n > 1 THEN
    UPDATE public.ciclos_credito SET status = 'expirado' WHERE contrato_id = k.id AND status = 'ativo' AND data_fim < v_ini;
    IF NOT EXISTS (SELECT 1 FROM public.ciclos_credito WHERE contrato_id = k.id AND data_inicio = v_ini) THEN
      INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
      VALUES (k.id, COALESCE(c.quantidade_creditos, 0), v_ini, v_fim, 'ativo');
    END IF;
    UPDATE public.contratos SET data_fim = v_ini + 30 WHERE id = k.id AND data_fim < v_ini + 30;
    UPDATE public.planos SET data_fim = v_ini + 30 WHERE id = k.plano_id AND (data_fim IS NULL OR data_fim < v_ini + 30);
  ELSE
    BEGIN
      PERFORM public.fn_mensalidade_manual_gerar(v_venda);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
      VALUES ('planos-semestral', 'mensalidade2_erro', 'Plano Semestral: mensalidade nº 2 não gerada', jsonb_build_object('contrato_id', k.id, 'erro', SQLERRM));
    END;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fn_semestral_cancelar(p_contrato uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_venda uuid; n_m int := 0; n_c int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Só administrador cancela o Plano Semestral'; END IF;
  SELECT * INTO k FROM public.contratos WHERE id = p_contrato AND plano_tipo = 'semestral_2027' FOR UPDATE;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contrato do Plano Semestral não encontrado'; END IF;
  IF k.data_cancelamento IS NOT NULL THEN RETURN jsonb_build_object('cancelado', true, 'repetido', true, 'acesso_ate', k.data_fim); END IF;
  SELECT id INTO v_venda FROM public.vendas WHERE plano_id = k.plano_id AND tipo = 'plano' ORDER BY created_at LIMIT 1;
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_mensalidades:'||v_venda::text,0));
  IF EXISTS (SELECT 1 FROM public.planos_2027_mensalidades WHERE venda_origem_id = v_venda AND status IN ('processando','desconhecido')) THEN
    RAISE EXCEPTION 'Há uma cobrança no cartão em processamento; aguarde o resultado antes de cancelar';
  END IF;
  UPDATE public.contratos SET data_cancelamento = v_hoje, multa_percentual = 0,
    motivo_cancelamento = COALESCE(NULLIF(p_motivo, ''), 'Cancelamento do Plano Semestral (sem multa)'),
    observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado em ' || v_hoje || ' sem multa; acesso até ' || k.data_fim
  WHERE id = k.id;
  WITH m AS (UPDATE public.planos_2027_mensalidades SET status = 'cancelado', proxima_tentativa_em = NULL
             WHERE venda_origem_id = v_venda AND status IN ('pendente','recusado','inadimplente') RETURNING 1)
  SELECT count(*) INTO n_m FROM m;
  WITH x AS (UPDATE public.cobrancas SET status = 'cancelado'
             WHERE contrato_id = k.id AND numero_ciclo > 1 AND status IN ('pendente','atrasado') RETURNING 1)
  SELECT count(*) INTO n_c FROM x;
  UPDATE public.planos SET renovacao_automatica = false, data_fim = k.data_fim WHERE id = k.plano_id;
  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'cancelado', 'Plano Semestral cancelado sem multa',
    jsonb_build_object('contrato_id', k.id, 'por', auth.uid(), 'acesso_ate', k.data_fim, 'mensalidades_canceladas', n_m));
  RETURN jsonb_build_object('cancelado', true, 'acesso_ate', k.data_fim, 'mensalidades_canceladas', n_m, 'cobrancas_canceladas', n_c, 'multa', 0);
END $$;
REVOKE ALL ON FUNCTION public.fn_semestral_cancelar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_semestral_cancelar(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_semestral_gerar_mensalidade(uuid, uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_semestral_valor_ciclo(uuid, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_semestral_diario(p_data date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n_enc int := 0; n_ger int := 0; v uuid;
BEGIN
  FOR r IN SELECT k.id, k.plano_id FROM public.contratos k
           WHERE k.plano_tipo = 'semestral_2027' AND k.status = 'ativo' AND k.data_cancelamento IS NOT NULL AND k.data_fim <= p_data
  LOOP
    UPDATE public.contratos SET status = 'cancelado' WHERE id = r.id;
    UPDATE public.planos SET ativo = false WHERE id = r.plano_id AND ativo;
    n_enc := n_enc + 1;
  END LOOP;
  FOR r IN SELECT DISTINCT ON (m.venda_origem_id) m.venda_origem_id, m.status
           FROM public.planos_2027_mensalidades m JOIN public.contratos k ON k.id = m.contrato_id
           WHERE k.plano_tipo = 'semestral_2027' AND k.status = 'ativo' AND k.data_cancelamento IS NULL
           ORDER BY m.venda_origem_id, m.numero DESC
  LOOP
    IF r.status = 'pago' THEN
      v := public.fn_mensalidade_manual_proximo(r.venda_origem_id);
      IF v IS NOT NULL THEN n_ger := n_ger + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('data', p_data, 'encerrados', n_enc, 'mensalidades_geradas', n_ger);
END $$;
REVOKE ALL ON FUNCTION public.fn_semestral_diario(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_diario(date) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_semestral_pix_guarda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (EXISTS (SELECT 1 FROM public.contratos k WHERE k.id = NEW.contrato_id AND k.plano_tipo = 'semestral_2027')
      OR EXISTS (SELECT 1 FROM public.planos p JOIN public.planos_catalogo c ON c.id = p.catalogo_id
                 WHERE p.id = NEW.plano_id AND c.familia = 'semestral_2027'))
     AND COALESCE((SELECT valor #>> '{}' FROM public.sistema_config WHERE chave = 'semestral_pix_automatico_ativo'), 'false') <> 'true' THEN
    RAISE EXCEPTION 'Pix Automático ainda não está liberado para o Plano Semestral';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_semestral_pix_guarda BEFORE INSERT ON public.pix_aut_itens FOR EACH ROW EXECUTE FUNCTION public.fn_semestral_pix_guarda();