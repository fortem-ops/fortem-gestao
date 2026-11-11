-- Pix Automático Etapa 2: cobrança mensal por grupo, renovação antecipada (8 dias) e troca automática de itens.
-- Fluxo 2027 antigo (fn_pix_automatico_2027_*, cobranca_recorrente_ativa) intocado.

CREATE TABLE IF NOT EXISTS public.pix_aut_ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.pix_aut_grupos(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  vencimento date NOT NULL,
  status text NOT NULL CHECK (status IN ('simulado','reservado','enviado','agendado','liquidado','divergente','falha','conferencia')),
  modo text NOT NULL CHECK (modo IN ('real','simulacao')),
  valor numeric(12,2) NOT NULL CHECK (valor >= 0),
  composicao jsonb NOT NULL DEFAULT '[]'::jsonb,
  txid text UNIQUE,
  tentativas smallint NOT NULL DEFAULT 0,
  ultimo_erro text,
  enviado_em timestamptz,
  liquidado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pix_aut_ciclos_grupo_venc_uq UNIQUE (grupo_id, vencimento)
);
COMMENT ON TABLE public.pix_aut_ciclos IS 'Uma cobrança Pix Automático por grupo e vencimento (idempotência). Escrita só pelas funções.';
GRANT SELECT ON public.pix_aut_ciclos TO authenticated;
GRANT ALL ON public.pix_aut_ciclos TO service_role;
ALTER TABLE public.pix_aut_ciclos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pix_aut_ciclos_select" ON public.pix_aut_ciclos;
CREATE POLICY "pix_aut_ciclos_select" ON public.pix_aut_ciclos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE OR REPLACE FUNCTION public.fn_pix_aut_hoje() RETURNS date
LANGUAGE sql STABLE SET search_path = public AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_avisar_equipe(p_titulo text, p_descricao text, p_aluno uuid, p_prioridade text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n uuid;
BEGIN
  INSERT INTO notificacoes (titulo, descricao, categoria, tipo, prioridade, status, aluno_id)
  VALUES (p_titulo, p_descricao, 'financeiro', 'simples', p_prioridade::notif_prioridade, 'nao_visualizada', p_aluno)
  RETURNING id INTO v_n;
  INSERT INTO notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT DISTINCT v_n, ur.user_id FROM user_roles ur WHERE ur.role IN ('admin','coordenador');
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_avisar_equipe(text, text, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_modo_grupo(p_grupo uuid, p_hoje date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave = 'pix_aut_grupos_cobranca_ativa'), 'false') <> 'true' THEN 'desligado'
    WHEN coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave = 'pix_aut_grupos_modo'), 'simulacao') = 'real'
     AND EXISTS (SELECT 1 FROM sistema_config WHERE chave = 'pix_aut_grupos_real_ids' AND jsonb_typeof(valor) = 'array' AND valor ? p_grupo::text)
     AND p_hoje >= coalesce((SELECT (valor #>> '{}')::date FROM sistema_config WHERE chave = 'pix_aut_grupos_real_desde'), DATE '2999-01-01')
    THEN 'real' ELSE 'simulacao' END
$$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_modo_grupo(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_composicao(p_grupo uuid, p_venc date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; v_itens jsonb := '[]'; v_falta jsonb := '[]'; v_total numeric := 0;
  v_cob uuid; v_cob_valor numeric; v_n int; v_venda uuid; v_venda_valor numeric; v_plano uuid;
BEGIN
  FOR it IN SELECT * FROM pix_aut_itens WHERE grupo_id = p_grupo AND ativo_ate IS NULL ORDER BY created_at LOOP
    v_cob := NULL; v_venda := NULL; v_venda_valor := NULL; v_cob_valor := NULL;
    IF it.item_tipo = 'contrato' THEN
      SELECT plano_id INTO v_plano FROM contratos WHERE id = it.contrato_id;
      SELECT count(*), max(b.id::text)::uuid, max(b.valor) INTO v_n, v_cob, v_cob_valor FROM cobrancas b
       WHERE b.contrato_id = it.contrato_id AND b.data_vencimento = p_venc AND b.status IN ('pendente','atrasado')
         AND (b.pix_aut_grupo_id IS NULL OR b.pix_aut_grupo_id = p_grupo);
      IF v_n <> 1 THEN
        v_falta := v_falta || jsonb_build_object('item', it.id, 'descricao', it.descricao, 'motivo', CASE WHEN v_n = 0 THEN 'cobranca_do_mes_nao_existe' ELSE 'cobranca_duplicada' END);
        CONTINUE;
      END IF;
      SELECT count(*), max(v.id::text)::uuid, max(v.valor_final) INTO v_n, v_venda, v_venda_valor FROM vendas v
       WHERE v.aluno_id = it.aluno_id AND v.tipo = 'plano' AND v.status_pagamento = 'pendente'
         AND (v.cobranca_id = v_cob OR (v.cobranca_id IS NULL AND v.plano_id = v_plano AND v.data_venda = p_venc))
         AND (v.pix_aut_grupo_id IS NULL OR v.pix_aut_grupo_id = p_grupo);
      IF v_n > 1 THEN
        v_falta := v_falta || jsonb_build_object('item', it.id, 'descricao', it.descricao, 'motivo', 'venda_do_mes_duplicada'); CONTINUE;
      END IF;
      IF v_venda IS NOT NULL AND v_venda_valor IS DISTINCT FROM v_cob_valor THEN
        v_falta := v_falta || jsonb_build_object('item', it.id, 'descricao', it.descricao, 'motivo', 'venda_e_cobranca_com_valores_diferentes'); CONTINUE;
      END IF;
      IF v_venda IS NULL AND EXISTS (SELECT 1 FROM vendas v WHERE v.aluno_id = it.aluno_id AND v.tipo = 'plano' AND v.status_pagamento = 'pago'
           AND (v.cobranca_id = v_cob OR (v.cobranca_id IS NULL AND v.plano_id = v_plano AND v.data_venda = p_venc))) THEN
        v_falta := v_falta || jsonb_build_object('item', it.id, 'descricao', it.descricao, 'motivo', 'venda_ja_paga_cobranca_aberta'); CONTINUE;
      END IF;
      v_itens := v_itens || jsonb_build_object('item', it.id, 'tipo', 'contrato', 'contrato_id', it.contrato_id, 'descricao', it.descricao,
        'cobranca_id', v_cob, 'venda_id', v_venda, 'valor', v_cob_valor);
      v_total := v_total + v_cob_valor;
    ELSE
      SELECT count(*), max(v.id::text)::uuid, max(v.valor_final) INTO v_n, v_venda, v_venda_valor FROM vendas v
       WHERE v.plano_id = it.plano_id AND v.tipo = 'plano' AND v.data_venda = p_venc AND v.status_pagamento = 'pendente'
         AND (v.pix_aut_grupo_id IS NULL OR v.pix_aut_grupo_id = p_grupo);
      IF v_n <> 1 OR coalesce(v_venda_valor, 0) <= 0 THEN
        v_falta := v_falta || jsonb_build_object('item', it.id, 'descricao', it.descricao, 'motivo', CASE WHEN v_n = 0 THEN 'venda_do_mes_nao_existe' WHEN v_n > 1 THEN 'venda_duplicada' ELSE 'valor_invalido' END);
        CONTINUE;
      END IF;
      v_itens := v_itens || jsonb_build_object('item', it.id, 'tipo', 'plano', 'plano_id', it.plano_id, 'descricao', it.descricao,
        'cobranca_id', NULL, 'venda_id', v_venda, 'valor', v_venda_valor);
      v_total := v_total + v_venda_valor;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('vencimento', p_venc, 'itens', v_itens, 'faltando', v_falta, 'valor', round(v_total, 2),
    'completo', jsonb_array_length(v_falta) = 0 AND jsonb_array_length(v_itens) > 0);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_composicao(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_proximo_venc(p_grupo uuid) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH g AS (SELECT dia_debito FROM pix_aut_grupos WHERE id = p_grupo),
  datas AS (
    SELECT b.data_vencimento d FROM pix_aut_itens i JOIN cobrancas b ON b.contrato_id = i.contrato_id
     WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND b.status IN ('pendente','atrasado')
    UNION ALL
    SELECT v.data_venda FROM pix_aut_itens i JOIN vendas v ON v.plano_id = i.plano_id
     WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND v.status_pagamento = 'pendente' AND v.tipo = 'plano'
    UNION ALL
    SELECT p.proxima_renovacao FROM pix_aut_itens i JOIN contratos c ON c.id = i.contrato_id JOIN planos p ON p.id = c.plano_id
     WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND p.ativo
    UNION ALL
    SELECT p.proxima_renovacao FROM pix_aut_itens i JOIN planos p ON p.id = i.plano_id
     WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND p.ativo
  )
  SELECT min(d) FROM datas, g
   WHERE d IS NOT NULL AND g.dia_debito IS NOT NULL AND d >= g.dia_debito
     AND NOT EXISTS (SELECT 1 FROM pix_aut_ciclos c WHERE c.grupo_id = p_grupo AND c.vencimento = d AND c.status NOT IN ('simulado','falha','reservado'))
$$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_proximo_venc(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclos_devidos(p_hoje date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_venc date; v_out jsonb := '[]'; v_modo text; v_acao text; c record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  FOR g IN SELECT gr.* FROM pix_aut_grupos gr JOIN pix_recorrencias r ON r.id = gr.recorrencia_id
            WHERE gr.status = 'ativa' AND r.status = 'AUTORIZADA' LOOP
    v_venc := public.fn_pix_aut_proximo_venc(g.id);
    CONTINUE WHEN v_venc IS NULL OR p_hoje < v_venc - 7;
    v_modo := public.fn_pix_aut_modo_grupo(g.id, p_hoje);
    CONTINUE WHEN v_modo = 'desligado';
    SELECT * INTO c FROM pix_aut_ciclos WHERE grupo_id = g.id AND vencimento = v_venc;
    IF p_hoje > v_venc - 3 THEN
      CONTINUE WHEN v_modo <> 'real' OR (c.id IS NOT NULL AND (c.status = 'simulado' OR coalesce(c.ultimo_erro,'') LIKE 'janela_perdida%'));
      v_acao := 'janela_perdida';
    ELSE
      v_acao := CASE WHEN v_modo = 'real' THEN 'enviar' ELSE 'simular' END;
      CONTINUE WHEN v_acao = 'simular' AND c.id IS NOT NULL;
    END IF;
    v_out := v_out || jsonb_build_object('grupo', g.id, 'aluno', g.aluno_id, 'vencimento', v_venc, 'acao', v_acao, 'modo', v_modo,
      'ciclo_status', c.status, 'txid', c.txid, 'composicao', public.fn_pix_aut_composicao(g.id, v_venc));
  END LOOP;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclos_devidos(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclos_devidos(date) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_simular(p_grupo uuid, p_venc date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_comp jsonb; g record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo;
  v_comp := public.fn_pix_aut_composicao(p_grupo, p_venc);
  INSERT INTO pix_aut_ciclos (grupo_id, aluno_id, vencimento, status, modo, valor, composicao)
  VALUES (p_grupo, g.aluno_id, p_venc, 'simulado', 'simulacao', (v_comp->>'valor')::numeric, v_comp)
  ON CONFLICT (grupo_id, vencimento) DO NOTHING;
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'ciclo_simulado', 'Simulação de envio ' || p_venc, jsonb_build_object('grupo', p_grupo, 'composicao', v_comp));
  RETURN v_comp;
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_simular(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_simular(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_soltar(p_ciclo uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM pix_aut_ciclos WHERE id = p_ciclo;
  PERFORM set_config('fortem.pix_aut_reserva', 'on', true);
  UPDATE cobrancas SET pix_aut_grupo_id = NULL WHERE pix_aut_grupo_id = c.grupo_id
     AND id IN (SELECT (x->>'cobranca_id')::uuid FROM jsonb_array_elements(c.composicao->'itens') x WHERE x->>'cobranca_id' IS NOT NULL);
  UPDATE vendas SET pix_aut_grupo_id = NULL WHERE pix_aut_grupo_id = c.grupo_id
     AND id IN (SELECT (x->>'venda_id')::uuid FROM jsonb_array_elements(c.composicao->'itens') x WHERE x->>'venda_id' IS NOT NULL);
  PERFORM set_config('fortem.pix_aut_reserva', '', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_soltar(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_falha(p_ciclo uuid, p_erro text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_nome text;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_ciclos WHERE id = p_ciclo FOR UPDATE;
  IF c.id IS NULL OR c.status IN ('liquidado','divergente','conferencia') THEN RETURN jsonb_build_object('ok', false, 'motivo', 'status_' || coalesce(c.status,'inexistente')); END IF;
  PERFORM public.fn_pix_aut_ciclo_soltar(p_ciclo);
  UPDATE pix_aut_ciclos SET status = 'falha', ultimo_erro = left(p_erro, 500), updated_at = now() WHERE id = p_ciclo;
  SELECT nome INTO v_nome FROM alunos WHERE id = c.aluno_id;
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'ciclo_falha', left(p_erro, 300), jsonb_build_object('ciclo', p_ciclo, 'grupo', c.grupo_id, 'vencimento', c.vencimento));
  PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático: falha no mês — ' || coalesce(v_nome, 'Aluno'),
    'Vencimento ' || to_char(c.vencimento, 'DD/MM/YYYY') || ': ' || left(p_erro, 300) || '. As cobranças seguem pendentes e liberadas para outra forma.', c.aluno_id, 'alta');
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_falha(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_falha(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_janela_perdida(p_grupo uuid, p_venc date, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_id uuid; v_comp jsonb;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo;
  v_comp := public.fn_pix_aut_composicao(p_grupo, p_venc);
  INSERT INTO pix_aut_ciclos (grupo_id, aluno_id, vencimento, status, modo, valor, composicao)
  VALUES (p_grupo, g.aluno_id, p_venc, 'falha', 'real', (v_comp->>'valor')::numeric, '{"itens":[]}'::jsonb)
  ON CONFLICT (grupo_id, vencimento) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM pix_aut_ciclos WHERE grupo_id = p_grupo AND vencimento = p_venc; END IF;
  RETURN public.fn_pix_aut_ciclo_falha(v_id, 'janela_perdida: ' || coalesce(p_motivo, 'não enviado até D-3'));
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_janela_perdida(uuid, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_janela_perdida(uuid, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_reservar(p_grupo uuid, p_venc date, p_hoje date, p_txid text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; c record; v_comp jsonb; v_valor numeric; v_cobs uuid[]; v_vendas uuid[]; v_n int; v_rec record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo FOR UPDATE;
  SELECT * INTO v_rec FROM pix_recorrencias WHERE id = g.recorrencia_id;
  IF g.status <> 'ativa' OR v_rec.status IS DISTINCT FROM 'AUTORIZADA' THEN RETURN jsonb_build_object('ok', false, 'motivo', 'grupo_nao_autorizado'); END IF;
  IF public.fn_pix_aut_modo_grupo(p_grupo, p_hoje) <> 'real' THEN RETURN jsonb_build_object('ok', false, 'motivo', 'modo_nao_real'); END IF;
  IF p_hoje < p_venc - 7 OR p_hoje > p_venc - 3 THEN RETURN jsonb_build_object('ok', false, 'motivo', 'fora_da_janela'); END IF;
  IF p_venc < g.dia_debito THEN RETURN jsonb_build_object('ok', false, 'motivo', 'antes_do_primeiro_debito'); END IF;

  SELECT * INTO c FROM pix_aut_ciclos WHERE grupo_id = p_grupo AND vencimento = p_venc FOR UPDATE;
  IF c.id IS NOT NULL AND c.status = 'reservado' THEN
    RETURN jsonb_build_object('ok', true, 'retomada', true, 'ciclo', c.id, 'txid', c.txid, 'valor', c.valor, 'vencimento', p_venc, 'id_rec', v_rec.id_rec, 'aluno', g.aluno_id, 'composicao', c.composicao);
  END IF;
  IF c.id IS NOT NULL AND c.status NOT IN ('simulado','falha') THEN RETURN jsonb_build_object('ok', false, 'motivo', 'ja_processado_' || c.status); END IF;

  v_comp := public.fn_pix_aut_composicao(p_grupo, p_venc);
  v_valor := (v_comp->>'valor')::numeric;
  IF NOT (v_comp->>'completo')::boolean THEN RETURN jsonb_build_object('ok', false, 'motivo', 'incompleto', 'composicao', v_comp); END IF;
  IF v_valor > g.valor_teto THEN RETURN jsonb_build_object('ok', false, 'motivo', 'acima_do_teto', 'composicao', v_comp); END IF;

  SELECT array_agg((x->>'cobranca_id')::uuid) FILTER (WHERE x->>'cobranca_id' IS NOT NULL),
         array_agg((x->>'venda_id')::uuid) FILTER (WHERE x->>'venda_id' IS NOT NULL)
    INTO v_cobs, v_vendas FROM jsonb_array_elements(v_comp->'itens') x;
  UPDATE cobrancas SET pix_aut_grupo_id = p_grupo WHERE id = ANY(coalesce(v_cobs, '{}')) AND status IN ('pendente','atrasado')
     AND (pix_aut_grupo_id IS NULL OR pix_aut_grupo_id = p_grupo);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> coalesce(array_length(v_cobs, 1), 0) THEN RAISE EXCEPTION 'reserva_cobranca_falhou'; END IF;
  UPDATE vendas SET pix_aut_grupo_id = p_grupo WHERE id = ANY(coalesce(v_vendas, '{}')) AND status_pagamento = 'pendente'
     AND (pix_aut_grupo_id IS NULL OR pix_aut_grupo_id = p_grupo);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> coalesce(array_length(v_vendas, 1), 0) THEN RAISE EXCEPTION 'reserva_venda_falhou'; END IF;

  IF c.id IS NULL THEN
    INSERT INTO pix_aut_ciclos (grupo_id, aluno_id, vencimento, status, modo, valor, composicao, txid, tentativas)
    VALUES (p_grupo, g.aluno_id, p_venc, 'reservado', 'real', v_valor, v_comp, p_txid, 1) RETURNING * INTO c;
  ELSE
    UPDATE pix_aut_ciclos SET status = 'reservado', modo = 'real', valor = v_valor, composicao = v_comp,
      txid = coalesce(txid, p_txid), tentativas = tentativas + 1, updated_at = now() WHERE id = c.id RETURNING * INTO c;
  END IF;
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'ciclo_reservado', 'Reserva ' || p_venc || ' R$ ' || v_valor, jsonb_build_object('ciclo', c.id, 'grupo', p_grupo, 'txid', c.txid, 'composicao', v_comp));
  RETURN jsonb_build_object('ok', true, 'ciclo', c.id, 'txid', c.txid, 'valor', v_valor, 'vencimento', p_venc, 'id_rec', v_rec.id_rec, 'aluno', g.aluno_id, 'composicao', v_comp);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_reservar(uuid, date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_reservar(uuid, date, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_enviado(p_ciclo uuid, p_status_inter text, p_raw jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_rec text; v_desc text;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_ciclos WHERE id = p_ciclo FOR UPDATE;
  IF c.status <> 'reservado' THEN RETURN jsonb_build_object('ok', true, 'acao', 'repetido', 'status', c.status); END IF;
  SELECT r.id_rec INTO v_rec FROM pix_aut_grupos g JOIN pix_recorrencias r ON r.id = g.recorrencia_id WHERE g.id = c.grupo_id;
  SELECT 'Mensalidades FORTEM ' || to_char(c.vencimento, 'MM/YYYY') || ': ' || string_agg(x->>'descricao' || ' R$ ' || (x->>'valor'), ' + ')
    INTO v_desc FROM jsonb_array_elements(c.composicao->'itens') x;
  INSERT INTO pix_cobrancas (id_rec, aluno_id, txid, valor, data_vencimento, status, descricao, raw_response)
  SELECT v_rec, c.aluno_id, c.txid, c.valor, c.vencimento, 'AGENDADA', v_desc, coalesce(p_raw, '{}'::jsonb) || jsonb_build_object('_grupo', c.grupo_id, '_ciclo', c.id)
  WHERE NOT EXISTS (SELECT 1 FROM pix_cobrancas WHERE txid = c.txid);
  UPDATE pix_aut_ciclos SET status = 'enviado', enviado_em = now(), ultimo_erro = NULL, updated_at = now() WHERE id = p_ciclo;
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'ciclo_enviado', 'Enviado ao Inter ' || c.vencimento || ' R$ ' || c.valor, jsonb_build_object('ciclo', c.id, 'txid', c.txid, 'status_inter', p_status_inter));
  RETURN jsonb_build_object('ok', true, 'acao', 'enviado');
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_enviado(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_enviado(uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_incerto(p_ciclo uuid, p_erro text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  UPDATE pix_aut_ciclos SET ultimo_erro = left('incerto: ' || p_erro, 500), updated_at = now() WHERE id = p_ciclo AND status = 'reservado';
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'ciclo_incerto', left(p_erro, 300), jsonb_build_object('ciclo', p_ciclo));
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_incerto(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_incerto(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclo_evento(p_txid text, p_status text, p_valor numeric, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; x jsonb; v_ok boolean := true; v_motivo text; v_nome text; v_hoje date := public.fn_pix_aut_hoje(); v_n int := 0;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_ciclos WHERE txid = p_txid FOR UPDATE;
  IF c.id IS NULL THEN RETURN jsonb_build_object('grupo', false); END IF;
  SELECT nome INTO v_nome FROM alunos WHERE id = c.aluno_id;

  IF p_status = 'LIQUIDADA' THEN
    IF c.status = 'liquidado' THEN RETURN jsonb_build_object('grupo', true, 'acao', 'repetido'); END IF;
    UPDATE pix_cobrancas SET status = 'LIQUIDADA', liquidado_em = coalesce(liquidado_em, now()) WHERE txid = p_txid;
    IF c.status NOT IN ('enviado','agendado','reservado') THEN v_ok := false; v_motivo := 'ciclo em ' || c.status || ' (possível pagamento em duplicidade)'; END IF;
    IF v_ok AND p_valor IS NOT NULL AND round(p_valor, 2) <> round(c.valor, 2) THEN v_ok := false; v_motivo := 'valor pago R$ ' || p_valor || ' diferente do enviado R$ ' || c.valor; END IF;
    IF v_ok THEN
      FOR x IN SELECT * FROM jsonb_array_elements(c.composicao->'itens') LOOP
        IF x->>'cobranca_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cobrancas WHERE id = (x->>'cobranca_id')::uuid
             AND status IN ('pendente','atrasado') AND pix_aut_grupo_id = c.grupo_id AND valor = (x->>'valor')::numeric) THEN
          v_ok := false; v_motivo := 'cobrança de ' || (x->>'descricao') || ' mudou ou já foi baixada';
        END IF;
        IF x->>'venda_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vendas WHERE id = (x->>'venda_id')::uuid
             AND status_pagamento = 'pendente' AND pix_aut_grupo_id = c.grupo_id) THEN
          v_ok := false; v_motivo := 'venda de ' || (x->>'descricao') || ' mudou ou já foi baixada';
        END IF;
      END LOOP;
    END IF;
    IF NOT v_ok THEN
      UPDATE pix_aut_ciclos SET status = 'divergente', ultimo_erro = v_motivo, liquidado_em = now(), updated_at = now() WHERE id = c.id;
      INSERT INTO system_logs (modulo, acao, mensagem, payload)
      VALUES ('pix-automatico-grupo', 'liquidado_divergente', v_motivo, jsonb_build_object('ciclo', c.id, 'txid', p_txid, 'valor_pago', p_valor));
      PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático recebido com divergência — ' || coalesce(v_nome, 'Aluno'),
        'Recebido no Inter, sem baixa automática: ' || v_motivo || '. Conferir e dar baixa manual.', c.aluno_id, 'alta');
      RETURN jsonb_build_object('grupo', true, 'acao', 'divergente', 'motivo', v_motivo);
    END IF;
    PERFORM set_config('fortem.pix_aut_baixa', p_txid, true);
    FOR x IN SELECT * FROM jsonb_array_elements(c.composicao->'itens') LOOP
      IF x->>'cobranca_id' IS NOT NULL THEN
        UPDATE cobrancas SET status = 'pago', data_pagamento = v_hoje, forma_pagamento = 'pix_automatico', gateway = 'inter_pix',
          meio_registro = 'gateway_webhook', tid = p_txid WHERE id = (x->>'cobranca_id')::uuid AND status IN ('pendente','atrasado');
      END IF;
      IF x->>'venda_id' IS NOT NULL THEN
        UPDATE vendas SET status_pagamento = 'pago', forma_pagamento = 'pix_automatico' WHERE id = (x->>'venda_id')::uuid AND status_pagamento = 'pendente';
      END IF;
      v_n := v_n + 1;
    END LOOP;
    PERFORM set_config('fortem.pix_aut_baixa', '', true);
    UPDATE pix_aut_ciclos SET status = 'liquidado', liquidado_em = now(), updated_at = now() WHERE id = c.id;
    INSERT INTO system_logs (modulo, acao, mensagem, payload)
    VALUES ('pix-automatico-grupo', 'liquidado', 'Baixa de ' || v_n || ' itens R$ ' || c.valor, jsonb_build_object('ciclo', c.id, 'txid', p_txid, 'composicao', c.composicao));
    PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático recebido — ' || coalesce(v_nome, 'Aluno'),
      'Mensalidades de ' || to_char(c.vencimento, 'DD/MM/YYYY') || ' baixadas: R$ ' || c.valor || '.', c.aluno_id, 'media');
    RETURN jsonb_build_object('grupo', true, 'acao', 'liquidado', 'itens', v_n);
  ELSIF p_status IN ('REJEITADA','CANCELADA','EXPIRADA') THEN
    UPDATE pix_cobrancas SET status = p_status, motivo_rejeicao = left(p_motivo, 500) WHERE txid = p_txid AND status <> 'LIQUIDADA';
    IF c.status IN ('liquidado','divergente','falha','conferencia') THEN RETURN jsonb_build_object('grupo', true, 'acao', 'ignorado'); END IF;
    PERFORM public.fn_pix_aut_ciclo_falha(c.id, 'Inter: cobrança ' || lower(p_status) || coalesce(' — ' || p_motivo, ''));
    RETURN jsonb_build_object('grupo', true, 'acao', 'falha');
  ELSIF p_status = 'AGENDADA' THEN
    UPDATE pix_cobrancas SET status = 'AGENDADA' WHERE txid = p_txid AND status NOT IN ('LIQUIDADA','REJEITADA','CANCELADA','EXPIRADA');
    UPDATE pix_aut_ciclos SET status = 'agendado', updated_at = now() WHERE id = c.id AND status IN ('reservado','enviado');
    RETURN jsonb_build_object('grupo', true, 'acao', 'agendado');
  END IF;
  RETURN jsonb_build_object('grupo', true, 'acao', 'sem_acao');
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclo_evento(text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclo_evento(text, text, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_reserva_guarda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pago boolean; v_era boolean;
BEGIN
  IF TG_TABLE_NAME = 'cobrancas' THEN v_pago := NEW.status = 'pago'; v_era := OLD.status = 'pago';
  ELSE v_pago := NEW.status_pagamento = 'pago'; v_era := OLD.status_pagamento = 'pago'; END IF;
  IF OLD.pix_aut_grupo_id IS DISTINCT FROM NEW.pix_aut_grupo_id AND NOT public.fn_pix_aut_eh_service()
     AND coalesce(current_setting('fortem.pix_aut_reserva', true), '') <> 'on' THEN
    RAISE EXCEPTION 'reserva_pix_somente_sistema' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_pago OR v_era OR OLD.pix_aut_grupo_id IS NULL THEN RETURN NEW; END IF;
  IF coalesce(current_setting('fortem.pix_aut_baixa', true), '') <> '' THEN RETURN NEW; END IF;
  IF public.fn_pix_aut_eh_service() THEN
    INSERT INTO system_logs (modulo, acao, mensagem, payload)
    VALUES ('pix-automatico-grupo', 'pago_fora_do_pix', TG_TABLE_NAME || ' reservada paga por outro caminho', jsonb_build_object('tabela', TG_TABLE_NAME, 'id', NEW.id, 'grupo', OLD.pix_aut_grupo_id));
    PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático: mensalidade paga por outro meio',
      'Uma mensalidade reservada ao Pix Automático foi paga por outro caminho. Conferir no Inter para não cobrar duas vezes.', NEW.aluno_id, 'alta');
    UPDATE pix_aut_ciclos SET status = 'conferencia', ultimo_erro = 'pago por outro caminho', updated_at = now()
     WHERE grupo_id = OLD.pix_aut_grupo_id AND status IN ('reservado','enviado','agendado')
       AND composicao::text LIKE '%' || NEW.id::text || '%';
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'reservado_pix_automatico' USING ERRCODE = 'P0001',
    HINT = 'Esta mensalidade está reservada ao Pix Automático. Libere a reserva (com confirmação) antes de dar baixa.';
END $$;
DROP TRIGGER IF EXISTS trg_pix_aut_reserva_guarda ON public.cobrancas;
CREATE TRIGGER trg_pix_aut_reserva_guarda BEFORE UPDATE OF status, pix_aut_grupo_id ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.fn_pix_aut_reserva_guarda();
DROP TRIGGER IF EXISTS trg_pix_aut_reserva_guarda ON public.vendas;
CREATE TRIGGER trg_pix_aut_reserva_guarda BEFORE UPDATE OF status_pagamento, pix_aut_grupo_id ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.fn_pix_aut_reserva_guarda();

CREATE OR REPLACE FUNCTION public.fn_pix_aut_venda_reservada(p_venda uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM vendas v WHERE v.id = p_venda AND (
      v.pix_aut_grupo_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM cobrancas b WHERE b.id = v.cobranca_id AND b.pix_aut_grupo_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM cobrancas b JOIN contratos k ON k.id = b.contrato_id
                  WHERE k.plano_id = v.plano_id AND b.data_vencimento = v.data_venda AND b.pix_aut_grupo_id IS NOT NULL
                    AND b.status IN ('pendente','atrasado'))))
$$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_venda_reservada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_venda_reservada(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_liberar_reserva(p_tabela text, p_id uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_grupo uuid; c record; x jsonb; v_aluno uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  IF p_tabela = 'cobrancas' THEN SELECT pix_aut_grupo_id, aluno_id INTO v_grupo, v_aluno FROM cobrancas WHERE id = p_id;
  ELSIF p_tabela = 'vendas' THEN SELECT pix_aut_grupo_id, aluno_id INTO v_grupo, v_aluno FROM vendas WHERE id = p_id;
  ELSE RAISE EXCEPTION 'tabela_invalida'; END IF;
  IF v_grupo IS NULL THEN RETURN jsonb_build_object('ok', true, 'acao', 'sem_reserva'); END IF;
  PERFORM set_config('fortem.pix_aut_reserva', 'on', true);
  SELECT * INTO c FROM pix_aut_ciclos WHERE grupo_id = v_grupo AND composicao::text LIKE '%' || p_id::text || '%'
     AND status IN ('reservado','enviado','agendado','falha') ORDER BY vencimento DESC LIMIT 1 FOR UPDATE;
  IF c.id IS NOT NULL THEN
    FOR x IN SELECT * FROM jsonb_array_elements(c.composicao->'itens') LOOP
      IF x->>'cobranca_id' = p_id::text OR x->>'venda_id' = p_id::text THEN
        UPDATE cobrancas SET pix_aut_grupo_id = NULL WHERE id = (x->>'cobranca_id')::uuid AND pix_aut_grupo_id = v_grupo;
        UPDATE vendas SET pix_aut_grupo_id = NULL WHERE id = (x->>'venda_id')::uuid AND pix_aut_grupo_id = v_grupo;
      END IF;
    END LOOP;
    UPDATE pix_aut_ciclos SET status = CASE WHEN status IN ('enviado','agendado','reservado') THEN 'conferencia' ELSE status END,
      ultimo_erro = 'reserva liberada pela equipe: ' || coalesce(p_motivo, ''), updated_at = now() WHERE id = c.id;
  END IF;
  IF p_tabela = 'cobrancas' THEN UPDATE cobrancas SET pix_aut_grupo_id = NULL WHERE id = p_id;
  ELSE UPDATE vendas SET pix_aut_grupo_id = NULL WHERE id = p_id; END IF;
  INSERT INTO system_logs (modulo, acao, mensagem, payload, user_id)
  VALUES ('pix-automatico-grupo', 'reserva_liberada', coalesce(p_motivo, 'baixa manual'), jsonb_build_object('tabela', p_tabela, 'id', p_id, 'grupo', v_grupo, 'ciclo', c.id, 'ciclo_status', c.status), auth.uid());
  IF c.status IN ('enviado','agendado','reservado') THEN
    PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático: reserva liberada com cobrança já no Inter',
      'A cobrança de ' || to_char(c.vencimento, 'DD/MM/YYYY') || ' pode já estar no Inter. Cancelar no Inter ou estornar se o débito acontecer.', v_aluno, 'alta');
  END IF;
  RETURN jsonb_build_object('ok', true, 'acao', 'liberada', 'ja_no_inter', coalesce(c.status IN ('enviado','agendado','reservado'), false));
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_liberar_reserva(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_liberar_reserva(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_planos_antecipar(p_hoje date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('plano_id', p.id, 'proxima_renovacao', p.proxima_renovacao,
           'eh_2027', coalesce(pc.familia IN ('start_2027','consultoria_2027'), false))), '[]'::jsonb)
  FROM planos p LEFT JOIN planos_catalogo pc ON pc.id = p.catalogo_id
  WHERE public.fn_pix_aut_eh_service()
    AND p.ativo AND coalesce(p.renovacao_automatica, false)
    AND p.proxima_renovacao > p_hoje AND p.proxima_renovacao <= p_hoje + 8
    AND (p.catalogo_id IS NULL OR pc.familia IN ('start_2027','consultoria_2027'))
    AND EXISTS (SELECT 1 FROM pix_aut_itens i JOIN pix_aut_grupos g ON g.id = i.grupo_id
                 WHERE g.status = 'ativa' AND i.ativo_ate IS NULL
                   AND (i.plano_id = p.id OR i.contrato_id IN (SELECT k.id FROM contratos k WHERE k.plano_id = p.id AND k.status IN ('ativo','inadimplente'))))
    AND NOT EXISTS (SELECT 1 FROM planos n WHERE n.aluno_id = p.aluno_id AND n.ativo AND n.atividade = p.atividade AND n.id <> p.id AND n.created_at > p.created_at)
$$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_planos_antecipar(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_planos_antecipar(date) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_migrar_itens() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; k record; p record; v_ids uuid[]; v_novo uuid; v_valor numeric; v_desc text;
  v_migrados jsonb := '[]'; v_pend jsonb := '[]'; v_soma numeric; g record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  FOR it IN SELECT i.* FROM pix_aut_itens i JOIN pix_aut_grupos gg ON gg.id = i.grupo_id
             WHERE i.ativo_ate IS NULL AND gg.status IN ('aguardando_autorizacao','ativa') FOR UPDATE OF i LOOP
    v_novo := NULL; v_ids := NULL;
    IF it.item_tipo = 'contrato' THEN
      SELECT * INTO k FROM contratos WHERE id = it.contrato_id;
      CONTINUE WHEN k.status IN ('ativo','inadimplente');
      SELECT array_agg(n.id) INTO v_ids FROM contratos n
       WHERE n.aluno_id = k.aluno_id AND n.id <> k.id AND n.status IN ('ativo','inadimplente')
         AND n.data_inicio = k.data_fim AND n.created_at > k.created_at AND coalesce(n.plano_tipo,'') = coalesce(k.plano_tipo,'')
         AND NOT EXISTS (SELECT 1 FROM pix_aut_itens x WHERE x.contrato_id = n.id AND x.ativo_ate IS NULL);
      IF coalesce(array_length(v_ids,1),0) = 1 THEN
        v_novo := v_ids[1];
        SELECT n.valor_cobrado, coalesce(pl.tipo, n.plano_tipo) INTO v_valor, v_desc FROM contratos n LEFT JOIN planos pl ON pl.id = n.plano_id WHERE n.id = v_novo;
      END IF;
    ELSE
      SELECT * INTO p FROM planos WHERE id = it.plano_id;
      CONTINUE WHEN p.ativo;
      SELECT array_agg(n.id) INTO v_ids FROM planos n
       WHERE n.aluno_id = p.aluno_id AND n.id <> p.id AND n.ativo AND n.atividade IS NOT DISTINCT FROM p.atividade
         AND n.tipo IS NOT DISTINCT FROM p.tipo AND n.created_at > p.created_at AND n.data_inicio = p.proxima_renovacao
         AND NOT EXISTS (SELECT 1 FROM contratos c WHERE c.plano_id = n.id)
         AND NOT EXISTS (SELECT 1 FROM pix_aut_itens x WHERE x.plano_id = n.id AND x.ativo_ate IS NULL);
      IF coalesce(array_length(v_ids,1),0) = 1 THEN
        v_novo := v_ids[1];
        SELECT n.valor, n.tipo INTO v_valor, v_desc FROM planos n WHERE n.id = v_novo;
      END IF;
    END IF;
    IF v_novo IS NULL OR coalesce(v_valor,0) <= 0 THEN
      v_pend := v_pend || jsonb_build_object('item', it.id, 'descricao', it.descricao, 'candidatos', coalesce(array_length(v_ids,1),0));
      CONTINUE;
    END IF;
    UPDATE pix_aut_itens SET ativo_ate = now() WHERE id = it.id;
    INSERT INTO pix_aut_itens (grupo_id, aluno_id, item_tipo, contrato_id, plano_id, descricao, valor, forma_anterior)
    VALUES (it.grupo_id, it.aluno_id, it.item_tipo, CASE WHEN it.item_tipo='contrato' THEN v_novo END,
            CASE WHEN it.item_tipo='plano' THEN v_novo END, v_desc, v_valor, it.forma_anterior);
    v_migrados := v_migrados || jsonb_build_object('grupo', it.grupo_id, 'item_antigo', it.id, 'de', coalesce(it.contrato_id, it.plano_id), 'para', v_novo, 'valor', v_valor);
    SELECT coalesce(sum(valor),0) INTO v_soma FROM pix_aut_itens WHERE grupo_id = it.grupo_id AND ativo_ate IS NULL;
    UPDATE pix_aut_grupos SET valor_soma = v_soma, updated_at = now() WHERE id = it.grupo_id RETURNING * INTO g;
    INSERT INTO system_logs (modulo, acao, mensagem, payload)
    VALUES ('pix-automatico-grupo', 'item_migrado', coalesce(v_desc,'item') || ' seguiu a renovação', v_migrados -> -1);
    IF v_soma > g.valor_teto THEN
      PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático: soma acima do teto autorizado',
        'Após a renovação a soma ficou R$ ' || v_soma || ', acima do teto R$ ' || g.valor_teto || '. O mês não será enviado até ajustar.', g.aluno_id, 'alta');
    END IF;
  END LOOP;
  IF jsonb_array_length(v_pend) > 0 THEN
    INSERT INTO system_logs (modulo, acao, mensagem, payload)
    VALUES ('pix-automatico-grupo', 'item_sem_sucessor', 'Itens encerrados sem renovação identificada', v_pend);
  END IF;
  RETURN jsonb_build_object('migrados', v_migrados, 'sem_sucessor', v_pend);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_migrar_itens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_migrar_itens() TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_grupo_registrar_rec(p_grupo uuid, p_rec uuid, p_codigo smallint, p_expira timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  UPDATE pix_recorrencias SET codigo_numero = p_codigo, codigo_expira_em = p_expira WHERE id = p_rec;
  UPDATE pix_aut_grupos SET recorrencia_id = p_rec, status = 'aguardando_autorizacao', codigo_expira_em = p_expira,
    dia_debito = coalesce((SELECT r.data_inicio FROM pix_recorrencias r WHERE r.id = p_rec), dia_debito), updated_at = now()
  WHERE id = p_grupo AND status IN ('rascunho','aguardando_autorizacao','falha');
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_grupo_registrar_rec(uuid, uuid, smallint, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_grupo_registrar_rec(uuid, uuid, smallint, timestamptz) TO service_role;

UPDATE public.pix_aut_grupos g SET dia_debito = r.data_inicio, updated_at = now()
  FROM public.pix_recorrencias r WHERE r.id = g.recorrencia_id AND r.data_inicio IS NOT NULL AND g.dia_debito IS DISTINCT FROM r.data_inicio;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_pode_cobrar(p_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m planos_2027_mensalidades; p propostas_planos_2027;
BEGIN
  SELECT * INTO m FROM planos_2027_mensalidades WHERE id = p_id;
  IF m.id IS NULL THEN RETURN 'nao_encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM pix_aut_itens i JOIN pix_aut_grupos g ON g.id = i.grupo_id
              WHERE i.contrato_id = m.contrato_id AND i.ativo_ate IS NULL AND g.status = 'ativa')
     OR EXISTS (SELECT 1 FROM cobrancas b WHERE b.mensalidade_2027_id = m.id AND b.pix_aut_grupo_id IS NOT NULL) THEN
    RETURN 'pix_automatico';
  END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_recorrencia_ativa'),'false') <> 'true' THEN RETURN 'desligado'; END IF;
  IF m.simulado THEN RETURN 'simulado'; END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_ativo'),'false') <> 'true' THEN RETURN 'cartao_real_desligado'; END IF;
  IF m.venda_origem_id IS NOT NULL THEN
    IF NOT public.fn_mensalidade_manual_cobravel(m.id) THEN RETURN 'manual_bloqueada'; END IF;
    IF EXISTS (SELECT 1 FROM sistema_config sc JOIN contratos k ON k.id = m.contrato_id
                WHERE sc.chave = 'vendas_2027_teste_aluno_ids' AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? k.aluno_id::text) THEN
      IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_pagamento_modo_teste'),'simulacao') <> 'real_baixo_valor' THEN RETURN 'teste_sem_modo_real'; END IF;
      IF m.valor_centavos > 100 THEN RETURN 'teto_teste'; END IF;
    ELSIF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_escopo'),'teste') <> 'todos' THEN
      RETURN 'escopo_teste';
    END IF;
    RETURN 'ok';
  END IF;
  SELECT * INTO p FROM propostas_planos_2027 WHERE id = m.proposta_id;
  IF p.assinatura_cancelada_em IS NOT NULL THEN RETURN 'cancelada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM rede_tokenizacoes t WHERE t.id = m.tokenizacao_id AND t.proposta_id = m.proposta_id
                 AND t.aluno_id IS NULL AND t.status = 'active' AND t.origem = 'planos_site') THEN RETURN 'token_invalido'; END IF;
  IF public.fn_checkout_2027_teste(m.proposta_id) THEN
    IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_pagamento_modo_teste'),'simulacao') <> 'real_baixo_valor' THEN RETURN 'teste_sem_modo_real'; END IF;
    IF m.valor_centavos > 100 THEN RETURN 'teto_teste'; END IF;
  ELSIF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_escopo'),'teste') <> 'todos' THEN
    RETURN 'escopo_teste';
  END IF;
  RETURN 'ok';
END $function$;