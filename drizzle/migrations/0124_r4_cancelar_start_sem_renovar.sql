CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_cancelar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE p propostas_planos_2027; n int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador')) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  SELECT * INTO p FROM propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF p.id IS NULL OR NOT EXISTS (SELECT 1 FROM planos_2027_mensalidades WHERE proposta_id = p_proposta_id) THEN RAISE EXCEPTION 'sem assinatura'; END IF;
  IF p.assinatura_cancelada_em IS NOT NULL THEN RETURN jsonb_build_object('resultado','ja_cancelada'); END IF;
  IF EXISTS (SELECT 1 FROM planos_2027_mensalidades WHERE proposta_id = p_proposta_id AND status = 'processando') THEN
    RAISE EXCEPTION 'cobrança em andamento, tente em alguns minutos';
  END IF;
  UPDATE propostas_planos_2027 SET assinatura_cancelada_em = now(), assinatura_cancelada_por = auth.uid() WHERE id = p_proposta_id;
  UPDATE planos_2027_mensalidades SET status='cancelado', proxima_tentativa_em=NULL
   WHERE proposta_id = p_proposta_id AND status IN ('pendente','recusado');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE rede_tokenizacoes t SET cardholder_name = NULL
   WHERE t.proposta_id = p_proposta_id AND t.aluno_id IS NULL AND t.cardholder_name IS NOT NULL;
  -- Start: fn_renovar_start_2027 deixa de abrir novo ciclo para assinatura cancelada.
  RETURN jsonb_build_object('resultado','cancelada','mensalidades_canceladas', n);
END $f$;

CREATE OR REPLACE FUNCTION public.fn_renovar_start_2027(p_plano uuid, p_data date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Assinatura do site cancelada pela equipe: encerra no ciclo atual, sem novo ciclo.
  IF EXISTS (SELECT 1 FROM public.propostas_planos_2027 pp WHERE pp.aluno_id = pl.aluno_id AND pp.familia = 'start_2027'
             AND pp.assinatura_cancelada_em IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.propostas_planos_2027 pp WHERE pp.aluno_id = pl.aluno_id AND pp.familia = 'start_2027'
             AND pp.assinatura_cancelada_em IS NULL AND pp.pago_em IS NOT NULL
             AND EXISTS (SELECT 1 FROM public.planos_2027_mensalidades m WHERE m.proposta_id = pp.id)) THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'assinatura cancelada');
  END IF;
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
$function$;