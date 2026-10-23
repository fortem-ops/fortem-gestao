-- E3c PROPOSTA (NÃO APLICADA). Renovação do Mensal da Consultoria Online; Start/Power/Pro inalterados.

CREATE OR REPLACE FUNCTION public.fn_mensalidade_manual_gerar(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v vendas; k contratos; pl planos; c1 cobrancas; t rede_tokenizacoes; n int; v_venc date; v_valor int; v_cob uuid; r record; v_qtd int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_mensalidades:'||p_venda_id::text,0));
  SELECT * INTO v FROM vendas WHERE id = p_venda_id;
  IF v.id IS NULL OR v.origem IS DISTINCT FROM 'manual' OR v.tipo_cobranca IS DISTINCT FROM 'recorrencia' OR v.catalogo_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM planos_catalogo pc WHERE pc.id = v.catalogo_id AND pc.versao = 2027) THEN
    RETURN jsonb_build_object('gerado', false, 'motivo', 'nao_e_venda_manual_2027_recorrente');
  END IF;
  IF v.status_pagamento IN ('cancelado','estornado') THEN RETURN jsonb_build_object('gerado', false, 'motivo', 'venda_cancelada'); END IF;
  IF EXISTS (SELECT 1 FROM planos_2027_mensalidades WHERE venda_origem_id = v.id) THEN
    RETURN jsonb_build_object('gerado', false, 'motivo', 'ja_gerado', 'idempotente', true);
  END IF;
  SELECT count(*) INTO n FROM contratos WHERE plano_id = v.plano_id AND aluno_id = v.aluno_id AND forma_pagamento = 'cartao_recorrencia';
  IF n <> 1 THEN RAISE EXCEPTION 'Contrato da venda ausente ou ambíguo'; END IF;
  SELECT * INTO k FROM contratos WHERE plano_id = v.plano_id AND aluno_id = v.aluno_id AND forma_pagamento = 'cartao_recorrencia';
  IF k.status <> 'ativo' OR k.data_cancelamento IS NOT NULL OR k.catalogo_id IS NULL THEN
    RETURN jsonb_build_object('gerado', false, 'motivo', 'contrato_inativo_ou_cancelamento');
  END IF;
  SELECT * INTO c1 FROM cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1;
  IF c1.id IS NULL OR c1.status <> 'pago' THEN RETURN jsonb_build_object('gerado', false, 'motivo', 'ciclo1_nao_pago'); END IF;
  SELECT tk.* INTO t FROM rede_tokenizacoes tk JOIN cartoes_salvos cs ON cs.id = tk.cartao_salvo_id
   WHERE tk.cartao_salvo_id = k.cartao_token_id AND tk.aluno_id = k.aluno_id AND tk.proposta_id IS NULL AND tk.status = 'active'
   ORDER BY tk.created_at DESC LIMIT 1;
  IF t.id IS NULL THEN
    INSERT INTO system_logs(modulo, acao, mensagem, payload) VALUES ('planos-recorrencia', 'manual_sem_cartao',
      'Venda manual recorrente sem cartão ativo vinculado ao contrato; mensalidades não geradas', jsonb_build_object('venda_id', v.id, 'contrato_id', k.id));
    RETURN jsonb_build_object('gerado', false, 'motivo', 'sem_cartao_ativo');
  END IF;
  IF k.plano_tipo IN ('start_2027', 'consultoria_2027') THEN
    SELECT * INTO pl FROM planos WHERE id = k.plano_id;
    IF NOT coalesce(pl.renovacao_automatica, false) THEN RETURN jsonb_build_object('gerado', false, 'motivo', 'sem_renovacao_automatica'); END IF;
    v_venc := (k.data_inicio + interval '1 month')::date;
    v_valor := round((pl.valor - LEAST(GREATEST(coalesce(pl.desconto_recorrente, 0), 0), pl.valor)) * 100)::int;
    IF EXISTS (SELECT 1 FROM cobrancas WHERE contrato_id = k.id AND numero_ciclo = 2) THEN RAISE EXCEPTION 'Cobrança nº 2 já existe no contrato'; END IF;
    INSERT INTO cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento, meio_registro, descricao, composicao)
    VALUES (k.id, k.aluno_id, 2, v_valor / 100.0, v_venc, 'pendente', 'cartao_recorrencia', 'automatico',
      'Mensalidade 2 — recorrência automática no cartão',
      jsonb_build_object('plano', v_valor / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb))
    RETURNING id INTO v_cob;
    INSERT INTO planos_2027_mensalidades (venda_origem_id, tokenizacao_id, contrato_id, cobranca_id, numero, competencia, vencimento, valor_centavos, simulado)
    VALUES (v.id, t.id, k.id, v_cob, 2, date_trunc('month', v_venc)::date, v_venc, v_valor, false);
    v_qtd := 1;
  ELSE
    FOR r IN SELECT * FROM cobrancas WHERE contrato_id = k.id AND numero_ciclo BETWEEN 2 AND 12 AND status IN ('pendente','atrasado') ORDER BY numero_ciclo LOOP
      INSERT INTO planos_2027_mensalidades (venda_origem_id, tokenizacao_id, contrato_id, cobranca_id, numero, competencia, vencimento, valor_centavos, simulado)
      VALUES (v.id, t.id, k.id, r.id, r.numero_ciclo, date_trunc('month', r.data_vencimento)::date, r.data_vencimento, round(r.valor * 100)::int, false);
      v_qtd := v_qtd + 1;
    END LOOP;
  END IF;
  INSERT INTO system_logs(modulo, acao, mensagem, payload) VALUES ('planos-recorrencia', 'manual_mensalidades_geradas',
    'Venda manual 2027 entrou na recorrência automática', jsonb_build_object('venda_id', v.id, 'contrato_id', k.id, 'quantidade', v_qtd, 'tokenizacao_id', t.id));
  RETURN jsonb_build_object('gerado', true, 'quantidade', v_qtd, 'contrato_id', k.id);
END $function$
;

CREATE OR REPLACE FUNCTION public.fn_mensalidade_manual_proximo(p_venda_origem uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u planos_2027_mensalidades; b planos_2027_mensalidades; k contratos; pl planos; v_venc date; v_cob uuid; v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_mensalidades:'||p_venda_origem::text,0));
  SELECT * INTO u FROM planos_2027_mensalidades WHERE venda_origem_id = p_venda_origem ORDER BY numero DESC LIMIT 1 FOR UPDATE;
  IF u.id IS NULL OR u.status <> 'pago' THEN RETURN NULL; END IF;
  SELECT * INTO k FROM contratos WHERE id = u.contrato_id;
  IF COALESCE(k.plano_tipo, '') NOT IN ('start_2027', 'consultoria_2027') OR k.data_cancelamento IS NOT NULL OR k.status NOT IN ('ativo','encerrado') THEN RETURN NULL; END IF;
  SELECT * INTO pl FROM planos WHERE id = k.plano_id;
  IF NOT coalesce(pl.renovacao_automatica, false) THEN RETURN NULL; END IF;
  SELECT * INTO b FROM planos_2027_mensalidades WHERE venda_origem_id = p_venda_origem ORDER BY numero LIMIT 1;
  v_venc := (b.vencimento + make_interval(months => u.numero + 1 - b.numero))::date;
  INSERT INTO cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento, meio_registro, descricao, composicao)
  VALUES (k.id, k.aluno_id, u.numero + 1, u.valor_centavos / 100.0, v_venc, 'pendente', 'cartao_recorrencia', 'automatico',
    'Mensalidade ' || (u.numero + 1) || ' — recorrência automática no cartão',
    jsonb_build_object('plano', u.valor_centavos / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb))
  RETURNING id INTO v_cob;
  INSERT INTO planos_2027_mensalidades (venda_origem_id, tokenizacao_id, contrato_id, cobranca_id, numero, competencia, vencimento, valor_centavos, simulado)
  VALUES (p_venda_origem, u.tokenizacao_id, k.id, v_cob, u.numero + 1, date_trunc('month', v_venc)::date, v_venc, u.valor_centavos, false)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

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
  v_venda uuid; v_plano uuid; v_contrato uuid; v_site boolean; v_m public.planos_2027_mensalidades; v_manual boolean := false;
  v_desc numeric := 0; v_cob numeric;
BEGIN
  SELECT * INTO pl FROM public.planos WHERE id = p_plano FOR UPDATE;
  IF NOT FOUND OR NOT pl.ativo OR NOT COALESCE(pl.renovacao_automatica, false) THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'plano inativo ou sem renovação automática');
  END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = pl.catalogo_id AND familia IN ('start_2027', 'consultoria_2027');
  IF NOT FOUND THEN RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'não é Start 2027'); END IF;
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
  v_site := EXISTS (SELECT 1 FROM public.planos_2027_mensalidades x JOIN public.contratos k2 ON k2.id = x.contrato_id WHERE k2.plano_id = pl.id);
  IF v_site THEN
    SELECT x.* INTO v_m FROM public.planos_2027_mensalidades x
     WHERE EXISTS (SELECT 1 FROM public.planos_2027_mensalidades x2 JOIN public.contratos k3 ON k3.id = x2.contrato_id
                    WHERE k3.plano_id = pl.id AND (x2.proposta_id = x.proposta_id OR x2.venda_origem_id = x.venda_origem_id))
       AND abs(x.vencimento - pl.proxima_renovacao) <= 15
     ORDER BY abs(x.vencimento - pl.proxima_renovacao), x.numero DESC LIMIT 1;
    IF v_m.id IS NULL OR v_m.status <> 'pago' THEN
      RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'aguardando mensalidade do site');
    END IF;
    v_manual := v_m.venda_origem_id IS NOT NULL;
  END IF;

  v_desc := LEAST(GREATEST(COALESCE(pl.desconto_recorrente, 0), 0), pl.valor);
  v_cob := pl.valor - v_desc;
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
    pl.valor, v_desc, v_cob, pl.forma_pagamento_padrao, 1, CASE WHEN v_site THEN 'pago' ELSE 'pendente' END::venda_status, v_ini, 'recorrencia', 0,
    'recorrencia', CASE WHEN v_site AND NOT v_manual THEN 'online' ELSE 'manual' END, CASE WHEN v_teste THEN 'teste_2027' WHEN v_site AND NOT v_manual THEN 'site_2027' ELSE 'renovacao_automatica' END, v_idem, NULL)
  RETURNING id INTO v_venda;

  INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade,
    data_fim, catalogo_id, plano_codigo, forma_pagamento_padrao, parcelas_padrao, renovacao_automatica, observacoes, desconto_recorrente)
  VALUES (pl.aluno_id, pl.tipo, v_ini, 1, pl.valor, true, ARRAY[]::text[], pl.atividade,
    v_fim, c.id, c.codigo, pl.forma_pagamento_padrao, 1, true, pl.observacoes, v_desc)
  RETURNING id INTO v_plano;
  UPDATE public.vendas SET plano_id = v_plano WHERE id = v_venda;
  UPDATE public.planos SET proxima_renovacao = v_fim WHERE id = v_plano;

  DELETE FROM public.cobrancas WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano);
  DELETE FROM public.ciclos_credito WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano);
  DELETE FROM public.contratos WHERE plano_id = v_plano;

  INSERT INTO public.contratos (aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, criado_por, servicos_inclusos, catalogo_id, observacoes, cartao_token_id)
  VALUES (pl.aluno_id, v_plano, c.familia, k.frequencia_semanal, COALESCE(c.quantidade_creditos, 0),
    'mensal', v_ini, v_fim, COALESCE(k.forma_pagamento, 'cartao_recorrencia'), pl.valor, v_cob, 0,
    1, 'ativo', k.criado_por, '{}'::jsonb, c.id, CASE WHEN v_teste THEN 'TESTE 2027' END,
    CASE WHEN v_manual THEN k.cartao_token_id END)
  RETURNING id INTO v_contrato;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato, COALESCE(c.quantidade_creditos, 0), v_ini, (v_fim - 1), 'ativo');

  IF v_site THEN
    IF v_manual THEN
      UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE venda_origem_id = v_m.venda_origem_id AND numero >= v_m.numero;
    ELSE
      UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE proposta_id = v_m.proposta_id AND numero >= v_m.numero;
    END IF;
  ELSE
  INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
    forma_pagamento, meio_registro, descricao, composicao)
  VALUES (v_contrato, pl.aluno_id, 1, v_cob, v_ini, 'pendente', pl.forma_pagamento_padrao, 'manual_admin',
    'Mensalidade ciclo ' || to_char(v_ini, 'DD/MM/YYYY') || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
    jsonb_build_object('plano', v_cob, 'servicos', 0, 'servicos_vendas', '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object('plano_anterior', pl.id, 'plano_id', v_plano, 'venda_id', v_venda,
    'contrato_id', v_contrato, 'ciclo_inicio', v_ini, 'ciclo_fim', v_fim - 1);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m planos_2027_mensalidades; p propostas_planos_2027; v_criador uuid; v_notif uuid; v_teste boolean; v_fam text; v_freq text;
BEGIN
  SELECT * INTO m FROM planos_2027_mensalidades WHERE id = p_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'inadimplente' OR m.notificacao_inadimplencia_id IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM propostas_planos_2027 WHERE id = m.proposta_id;
  IF m.venda_origem_id IS NOT NULL THEN
    SELECT a.nome, a.telefone, k.plano_tipo, pc.frequencia::text INTO p.nome, p.whatsapp, v_fam, v_freq
      FROM contratos k JOIN alunos a ON a.id = k.aluno_id LEFT JOIN planos_catalogo pc ON pc.id = k.catalogo_id WHERE k.id = m.contrato_id;
    p.familia := v_fam; p.frequencia := v_freq;
    p.teste_admin := EXISTS (SELECT 1 FROM sistema_config sc JOIN contratos k ON k.id = m.contrato_id
                WHERE sc.chave = 'vendas_2027_teste_aluno_ids' AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? k.aluno_id::text);
  END IF;
  SELECT ur.user_id INTO v_criador FROM user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_criador IS NULL THEN RETURN NULL; END IF;
  v_teste := m.simulado OR coalesce(p.teste_admin, false);
  INSERT INTO notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (
    CASE WHEN v_teste THEN '[TESTE] ' ELSE '' END || 'Mensalidade recusada 3 vezes: ' || coalesce(p.nome, 'sem nome'),
    CASE p.familia WHEN 'start_2027' THEN 'Start' WHEN 'power_2027' THEN 'Power' WHEN 'pro_2027' THEN 'Pro' WHEN 'consultoria_2027' THEN 'Consultoria Online' ELSE coalesce(p.familia,'') END
      || ' ' || coalesce(p.frequencia,'') || CASE WHEN m.venda_origem_id IS NOT NULL THEN ' · recorrência no cartão (venda da equipe)' ELSE ' · assinatura no cartão' END || E'\n'
      || 'Mensalidade ' || m.numero || ' · vencimento ' || to_char(m.vencimento, 'DD/MM/YYYY') || ' · R$ '
      || translate(to_char(m.valor_centavos::numeric / 100, 'FM999,999,990.00'), ',.', '.,') || E'\n'
      || 'Último motivo: ' || coalesce(m.motivo, '-') || E'\n'
      || 'WhatsApp ' || coalesce(p.whatsapp, '-') || E'\n\n'
      || CASE WHEN v_teste THEN 'Teste: não cobrar nada.'
              WHEN p.familia = 'start_2027' THEN 'Crédito do ciclo não liberado. Ação: falar com o aluno; pagamento manual retoma a assinatura.'
              WHEN p.familia = 'consultoria_2027' THEN 'Ação: falar com o aluno e cobrar a mensalidade.'
              ELSE 'Créditos do plano mantidos. Ação: falar com o aluno e cobrar a mensalidade.' END,
    'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM user_roles ur WHERE ur.role IN ('admin','coordenador');
  UPDATE planos_2027_mensalidades SET notificacao_inadimplencia_id = v_notif WHERE id = p_id;
  RETURN v_notif;
END $function$
;

REVOKE ALL ON FUNCTION public.fn_mensalidade_manual_gerar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mensalidade_manual_gerar(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fn_mensalidade_manual_proximo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mensalidade_manual_proximo(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fn_renovar_start_2027(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_renovar_start_2027(uuid, date) TO service_role;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(uuid) TO service_role;
