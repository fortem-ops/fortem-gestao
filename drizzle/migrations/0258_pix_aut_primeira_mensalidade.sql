-- Pix Automático: 1ª mensalidade por Pix imediato (/cob), separada da autorização.
-- Uma cobrança por grupo + mês + finalidade; reserva as linhas (mesma coluna pix_aut_grupo_id da Etapa 2).
CREATE TABLE IF NOT EXISTS public.pix_aut_imediatas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.pix_aut_grupos(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  mes date NOT NULL,
  finalidade text NOT NULL DEFAULT 'primeira_mensalidade' CHECK (finalidade IN ('primeira_mensalidade')),
  status text NOT NULL CHECK (status IN ('reservado','ativa','liquidada','expirada','divergente','conferencia','falha')),
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  composicao jsonb NOT NULL DEFAULT '{}'::jsonb,
  txid text NOT NULL UNIQUE,
  pix_copia_cola text,
  expira_em timestamptz NOT NULL,
  valor_pago numeric(12,2),
  e2e_id text,
  data_pagamento date,
  liquidado_em timestamptz,
  ultimo_erro text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pix_aut_imediatas IS 'Pix imediato da 1ª mensalidade de um grupo de Pix Automático. Escrita só pelas funções.';
CREATE UNIQUE INDEX IF NOT EXISTS pix_aut_imediatas_vigente_uq ON public.pix_aut_imediatas (grupo_id, mes, finalidade)
  WHERE status IN ('reservado','ativa','liquidada','divergente','conferencia');
GRANT SELECT ON public.pix_aut_imediatas TO authenticated;
GRANT ALL ON public.pix_aut_imediatas TO service_role;
ALTER TABLE public.pix_aut_imediatas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pix_aut_imediatas_select" ON public.pix_aut_imediatas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

-- Composição: pendências do mês corrente ou vencidas, antes do 1º débito automático. Mesma regra da Etapa 2 por vencimento.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_composicao(p_grupo uuid, p_hoje date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; d date; v_comp jsonb; x jsonb; v_itens jsonb := '[]'; v_bloq jsonb := '[]'; v_total numeric := 0;
  v_fim date := (date_trunc('month', p_hoje) + interval '1 month - 1 day')::date;
BEGIN
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo;
  IF g.id IS NULL THEN RETURN jsonb_build_object('itens', '[]'::jsonb, 'bloqueios', '[]'::jsonb, 'valor', 0, 'completo', false); END IF;
  FOR d IN
    SELECT DISTINCT x.d FROM (
      SELECT b.data_vencimento d FROM pix_aut_itens i JOIN cobrancas b ON b.contrato_id = i.contrato_id
       WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND b.status IN ('pendente','atrasado')
         AND (b.pix_aut_grupo_id IS NULL OR b.pix_aut_grupo_id = p_grupo)
      UNION
      SELECT v.data_venda FROM pix_aut_itens i JOIN vendas v ON v.plano_id = i.plano_id
       WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND v.tipo = 'plano' AND v.status_pagamento = 'pendente'
         AND (v.pix_aut_grupo_id IS NULL OR v.pix_aut_grupo_id = p_grupo)
    ) x
    WHERE x.d IS NOT NULL AND x.d <= v_fim AND x.d < coalesce(g.dia_debito, DATE '2999-01-01')
    ORDER BY 1
  LOOP
    v_comp := public.fn_pix_aut_composicao(p_grupo, d);
    FOR x IN SELECT * FROM jsonb_array_elements(v_comp->'itens') LOOP
      v_itens := v_itens || (x || jsonb_build_object('vencimento', d));
      v_total := v_total + (x->>'valor')::numeric;
    END LOOP;
    FOR x IN SELECT * FROM jsonb_array_elements(v_comp->'faltando') LOOP
      IF (x->>'motivo') NOT LIKE '%nao_existe' THEN v_bloq := v_bloq || (x || jsonb_build_object('vencimento', d)); END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('itens', v_itens, 'bloqueios', v_bloq, 'valor', round(v_total, 2),
    'completo', jsonb_array_length(v_bloq) = 0 AND jsonb_array_length(v_itens) > 0, 'proximo_debito', g.dia_debito);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_composicao(uuid, date) FROM PUBLIC, anon, authenticated;

-- Libera as linhas reservadas por uma cobrança imediata (só as que ainda apontam para o grupo e seguem abertas).
CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_soltar(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM pix_aut_imediatas WHERE id = p_id;
  PERFORM set_config('fortem.pix_aut_reserva', 'on', true);
  UPDATE cobrancas SET pix_aut_grupo_id = NULL WHERE pix_aut_grupo_id = c.grupo_id AND status IN ('pendente','atrasado')
     AND id IN (SELECT (x->>'cobranca_id')::uuid FROM jsonb_array_elements(c.composicao->'itens') x WHERE x->>'cobranca_id' IS NOT NULL);
  UPDATE vendas SET pix_aut_grupo_id = NULL WHERE pix_aut_grupo_id = c.grupo_id AND status_pagamento = 'pendente'
     AND id IN (SELECT (x->>'venda_id')::uuid FROM jsonb_array_elements(c.composicao->'itens') x WHERE x->>'venda_id' IS NOT NULL);
  PERFORM set_config('fortem.pix_aut_reserva', '', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_soltar(uuid) FROM PUBLIC, anon, authenticated;

-- Expira (e libera a reserva) as cobranças imediatas vencidas há mais de 10 minutos sem pagamento.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_expirar() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_n int := 0;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  FOR c IN SELECT * FROM pix_aut_imediatas WHERE status IN ('reservado','ativa') AND expira_em + interval '10 minutes' < now() FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.fn_pix_aut_primeira_soltar(c.id);
    UPDATE pix_aut_imediatas SET status = 'expirada', updated_at = now() WHERE id = c.id;
    UPDATE pix_cobrancas SET status = 'EXPIRADA' WHERE txid = c.txid AND status NOT IN ('LIQUIDADA','CONCLUIDA');
    INSERT INTO system_logs (modulo, acao, mensagem, payload)
    VALUES ('pix-automatico-grupo', 'primeira_expirada', 'Pix da 1ª mensalidade expirou sem pagamento; reserva liberada', jsonb_build_object('id', c.id, 'grupo', c.grupo_id, 'txid', c.txid));
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('expiradas', v_n);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_expirar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_expirar() TO service_role;

-- Prévia para a tela (admin e coordenador veem; só admin gera).
CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_previa(p_grupo uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_hoje date := public.fn_pix_aut_hoje(); c record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.fn_pix_aut_eh_service()) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo;
  IF g.id IS NULL OR g.status NOT IN ('aguardando_autorizacao','ativa') THEN RETURN jsonb_build_object('disponivel', false); END IF;
  SELECT * INTO c FROM pix_aut_imediatas WHERE grupo_id = p_grupo AND mes = date_trunc('month', v_hoje)::date
     AND finalidade = 'primeira_mensalidade' AND status IN ('reservado','ativa','liquidada','divergente','conferencia') LIMIT 1;
  RETURN jsonb_build_object('disponivel', true, 'composicao', public.fn_pix_aut_primeira_composicao(p_grupo, v_hoje),
    'atual', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'status', c.status, 'valor', c.valor, 'txid', c.txid,
      'pix_copia_cola', c.pix_copia_cola, 'expira_em', c.expira_em, 'composicao', c.composicao, 'data_pagamento', c.data_pagamento, 'ultimo_erro', c.ultimo_erro) END);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_previa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_previa(uuid) TO authenticated, service_role;

-- Reserva (ou reaproveita) a cobrança imediata do mês. Só sistema (edge function admin-only).
CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_reservar(p_grupo uuid, p_txid text, p_usuario uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; c record; v_hoje date := public.fn_pix_aut_hoje(); v_mes date; v_comp jsonb; v_cobs uuid[]; v_vendas uuid[]; v_n int;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  v_mes := date_trunc('month', v_hoje)::date;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo FOR UPDATE;
  IF g.id IS NULL OR g.status NOT IN ('aguardando_autorizacao','ativa') THEN RETURN jsonb_build_object('ok', false, 'motivo', 'grupo_sem_autorizacao_vigente'); END IF;
  PERFORM public.fn_pix_aut_primeira_expirar();
  SELECT * INTO c FROM pix_aut_imediatas WHERE grupo_id = p_grupo AND mes = v_mes AND finalidade = 'primeira_mensalidade'
     AND status IN ('reservado','ativa','liquidada','divergente','conferencia') FOR UPDATE;
  IF c.id IS NOT NULL THEN
    IF c.status = 'ativa' AND c.expira_em > now() + interval '5 minutes' THEN
      RETURN jsonb_build_object('ok', true, 'acao', 'reaproveitada', 'id', c.id, 'txid', c.txid, 'valor', c.valor, 'composicao', c.composicao,
        'pix_copia_cola', c.pix_copia_cola, 'expira_em', c.expira_em);
    ELSIF c.status = 'reservado' THEN
      RETURN jsonb_build_object('ok', true, 'acao', 'retomada', 'id', c.id, 'txid', c.txid, 'valor', c.valor, 'composicao', c.composicao, 'aluno', g.aluno_id);
    ELSIF c.status = 'ativa' THEN
      RETURN jsonb_build_object('ok', false, 'motivo', 'qr_expirando_aguarde');
    ELSE
      RETURN jsonb_build_object('ok', false, 'motivo', 'ja_' || c.status);
    END IF;
  END IF;
  v_comp := public.fn_pix_aut_primeira_composicao(p_grupo, v_hoje);
  IF NOT (v_comp->>'completo')::boolean THEN RETURN jsonb_build_object('ok', false, 'motivo', 'sem_pendencias_ou_bloqueio', 'composicao', v_comp); END IF;
  SELECT array_agg((x->>'cobranca_id')::uuid) FILTER (WHERE x->>'cobranca_id' IS NOT NULL),
         array_agg((x->>'venda_id')::uuid) FILTER (WHERE x->>'venda_id' IS NOT NULL)
    INTO v_cobs, v_vendas FROM jsonb_array_elements(v_comp->'itens') x;
  PERFORM set_config('fortem.pix_aut_reserva', 'on', true);
  UPDATE cobrancas SET pix_aut_grupo_id = p_grupo WHERE id = ANY(coalesce(v_cobs, '{}')) AND status IN ('pendente','atrasado')
     AND (pix_aut_grupo_id IS NULL OR pix_aut_grupo_id = p_grupo);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> coalesce(array_length(v_cobs, 1), 0) THEN RAISE EXCEPTION 'reserva_cobranca_falhou'; END IF;
  UPDATE vendas SET pix_aut_grupo_id = p_grupo WHERE id = ANY(coalesce(v_vendas, '{}')) AND status_pagamento = 'pendente'
     AND (pix_aut_grupo_id IS NULL OR pix_aut_grupo_id = p_grupo);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> coalesce(array_length(v_vendas, 1), 0) THEN RAISE EXCEPTION 'reserva_venda_falhou'; END IF;
  PERFORM set_config('fortem.pix_aut_reserva', '', true);
  INSERT INTO pix_aut_imediatas (grupo_id, aluno_id, mes, status, valor, composicao, txid, expira_em, criado_por)
  VALUES (p_grupo, g.aluno_id, v_mes, 'reservado', (v_comp->>'valor')::numeric, v_comp, p_txid, now() + interval '2 days', p_usuario)
  RETURNING * INTO c;
  INSERT INTO system_logs (modulo, acao, mensagem, payload, user_id)
  VALUES ('pix-automatico-grupo', 'primeira_reservada', 'Reserva 1ª mensalidade R$ ' || c.valor, jsonb_build_object('id', c.id, 'grupo', p_grupo, 'txid', c.txid, 'composicao', v_comp), p_usuario);
  RETURN jsonb_build_object('ok', true, 'acao', 'nova', 'id', c.id, 'txid', c.txid, 'valor', c.valor, 'composicao', v_comp, 'aluno', g.aluno_id);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_reservar(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_reservar(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_ativar(p_id uuid, p_copia text, p_expira timestamptz, p_raw jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_desc text;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_imediatas WHERE id = p_id FOR UPDATE;
  IF c.status <> 'reservado' THEN RETURN jsonb_build_object('ok', false, 'motivo', 'status_' || c.status); END IF;
  SELECT 'FORTEM 1ª mensalidade: ' || string_agg((x->>'descricao') || ' R$ ' || (x->>'valor'), ' + ') INTO v_desc FROM jsonb_array_elements(c.composicao->'itens') x;
  INSERT INTO pix_cobrancas (aluno_id, txid, valor, status, descricao, raw_response)
  SELECT c.aluno_id, c.txid, c.valor, 'ATIVA', v_desc, coalesce(p_raw, '{}'::jsonb) || jsonb_build_object('_imediata', c.id, '_grupo', c.grupo_id)
  WHERE NOT EXISTS (SELECT 1 FROM pix_cobrancas WHERE txid = c.txid);
  UPDATE pix_aut_imediatas SET status = 'ativa', pix_copia_cola = p_copia, expira_em = p_expira, ultimo_erro = NULL, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_ativar(uuid, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_ativar(uuid, text, timestamptz, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_falha(p_id uuid, p_erro text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_imediatas WHERE id = p_id FOR UPDATE;
  IF c.status <> 'reservado' THEN RETURN jsonb_build_object('ok', false, 'motivo', 'status_' || c.status); END IF;
  PERFORM public.fn_pix_aut_primeira_soltar(p_id);
  UPDATE pix_aut_imediatas SET status = 'falha', ultimo_erro = left(p_erro, 500), updated_at = now() WHERE id = p_id;
  INSERT INTO system_logs (modulo, acao, mensagem, payload) VALUES ('pix-automatico-grupo', 'primeira_falha', left(p_erro, 300), jsonb_build_object('id', p_id, 'txid', c.txid));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_falha(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_falha(uuid, text) TO service_role;

-- Pagamento recebido (webhook "pix"): baixa dividida e idempotente; divergência vai para conferência, sem baixa.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_evento(p_txid text, p_valor numeric, p_e2e text, p_horario timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; x jsonb; v_ok boolean := true; v_motivo text; v_nome text; v_n int := 0;
  v_data date := (coalesce(p_horario, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_imediatas WHERE txid = p_txid FOR UPDATE;
  IF c.id IS NULL THEN RETURN jsonb_build_object('imediata', false); END IF;
  IF c.status IN ('liquidada','divergente','conferencia') AND c.e2e_id IS NOT DISTINCT FROM coalesce(p_e2e, c.e2e_id) THEN
    RETURN jsonb_build_object('imediata', true, 'acao', 'repetido', 'status', c.status);
  END IF;
  SELECT nome INTO v_nome FROM alunos WHERE id = c.aluno_id;
  UPDATE pix_cobrancas SET status = 'LIQUIDADA', liquidado_em = coalesce(liquidado_em, now()) WHERE txid = p_txid;
  IF c.status IN ('liquidada','divergente','conferencia') THEN v_ok := false; v_motivo := 'segundo pagamento recebido para o mesmo Pix (possível duplicidade)';
  ELSIF c.status NOT IN ('ativa','reservado') THEN v_ok := false; v_motivo := 'Pix pago com status ' || c.status || ' (reserva já liberada)'; END IF;
  IF v_ok AND (p_valor IS NULL OR round(p_valor, 2) <> round(c.valor, 2)) THEN v_ok := false; v_motivo := 'valor pago R$ ' || coalesce(p_valor::text, '?') || ' diferente do cobrado R$ ' || c.valor; END IF;
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
    UPDATE pix_aut_imediatas SET status = CASE WHEN status = 'liquidada' THEN 'liquidada' ELSE 'divergente' END,
      ultimo_erro = v_motivo, valor_pago = coalesce(valor_pago, p_valor), e2e_id = coalesce(e2e_id, p_e2e), liquidado_em = coalesce(liquidado_em, now()), updated_at = now() WHERE id = c.id;
    INSERT INTO system_logs (modulo, acao, mensagem, payload)
    VALUES ('pix-automatico-grupo', 'primeira_divergente', v_motivo, jsonb_build_object('id', c.id, 'txid', p_txid, 'valor_pago', p_valor, 'e2e', p_e2e));
    PERFORM public.fn_pix_aut_avisar_equipe('Pix da 1ª mensalidade com divergência — ' || coalesce(v_nome, 'Aluno'),
      'Recebido no Inter, sem baixa automática: ' || v_motivo || '. Conferir e dar baixa manual ou estornar.', c.aluno_id, 'alta');
    RETURN jsonb_build_object('imediata', true, 'acao', 'divergente', 'motivo', v_motivo);
  END IF;
  PERFORM set_config('fortem.pix_aut_baixa', p_txid, true);
  FOR x IN SELECT * FROM jsonb_array_elements(c.composicao->'itens') LOOP
    IF x->>'cobranca_id' IS NOT NULL THEN
      UPDATE cobrancas SET status = 'pago', data_pagamento = v_data, forma_pagamento = 'pix', gateway = 'inter_pix',
        meio_registro = 'gateway_webhook', tid = p_txid WHERE id = (x->>'cobranca_id')::uuid AND status IN ('pendente','atrasado');
    END IF;
    IF x->>'venda_id' IS NOT NULL THEN
      UPDATE vendas SET status_pagamento = 'pago', forma_pagamento = 'pix' WHERE id = (x->>'venda_id')::uuid AND status_pagamento = 'pendente';
    END IF;
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('fortem.pix_aut_baixa', '', true);
  UPDATE pix_aut_imediatas SET status = 'liquidada', valor_pago = p_valor, e2e_id = p_e2e, data_pagamento = v_data, liquidado_em = now(), updated_at = now() WHERE id = c.id;
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'primeira_liquidada', 'Baixa de ' || v_n || ' itens R$ ' || c.valor, jsonb_build_object('id', c.id, 'txid', p_txid, 'composicao', c.composicao));
  PERFORM public.fn_pix_aut_avisar_equipe('Pix da 1ª mensalidade recebido — ' || coalesce(v_nome, 'Aluno'),
    'Baixa automática de ' || v_n || ' item(ns): R$ ' || c.valor || ' em ' || to_char(v_data, 'DD/MM/YYYY') || '.', c.aluno_id, 'media');
  RETURN jsonb_build_object('imediata', true, 'acao', 'liquidada', 'itens', v_n);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_evento(text, numeric, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_evento(text, numeric, text, timestamptz) TO service_role;

-- Guarda da reserva: também marca a cobrança imediata para conferência se a linha for paga por outro caminho.
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
    UPDATE pix_aut_imediatas SET status = 'conferencia', ultimo_erro = 'pago por outro caminho', updated_at = now()
     WHERE grupo_id = OLD.pix_aut_grupo_id AND status IN ('reservado','ativa')
       AND composicao::text LIKE '%' || NEW.id::text || '%';
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'reservado_pix_automatico' USING ERRCODE = 'P0001',
    HINT = 'Esta mensalidade está reservada ao Pix Automático. Libere a reserva (com confirmação) antes de dar baixa.';
END $$;

-- Liberação manual pelo admin: se a linha estiver num Pix imediato ainda pagável, ele vai para conferência com aviso.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_liberar_reserva(p_tabela text, p_id uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_grupo uuid; c record; im record; x jsonb; v_aluno uuid;
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
  SELECT * INTO im FROM pix_aut_imediatas WHERE grupo_id = v_grupo AND composicao::text LIKE '%' || p_id::text || '%'
     AND status IN ('reservado','ativa') LIMIT 1 FOR UPDATE;
  IF im.id IS NOT NULL THEN
    FOR x IN SELECT * FROM jsonb_array_elements(im.composicao->'itens') LOOP
      IF x->>'cobranca_id' = p_id::text OR x->>'venda_id' = p_id::text THEN
        UPDATE cobrancas SET pix_aut_grupo_id = NULL WHERE id = (x->>'cobranca_id')::uuid AND pix_aut_grupo_id = v_grupo;
        UPDATE vendas SET pix_aut_grupo_id = NULL WHERE id = (x->>'venda_id')::uuid AND pix_aut_grupo_id = v_grupo;
      END IF;
    END LOOP;
    UPDATE pix_aut_imediatas SET status = 'conferencia', ultimo_erro = 'reserva liberada pela equipe: ' || coalesce(p_motivo, ''), updated_at = now() WHERE id = im.id;
    PERFORM public.fn_pix_aut_avisar_equipe('Pix da 1ª mensalidade: reserva liberada com QR ainda válido',
      'O QR da 1ª mensalidade ainda pode ser pago. Se o aluno pagar, conferir para não cobrar duas vezes.', v_aluno, 'alta');
  END IF;
  IF p_tabela = 'cobrancas' THEN UPDATE cobrancas SET pix_aut_grupo_id = NULL WHERE id = p_id;
  ELSE UPDATE vendas SET pix_aut_grupo_id = NULL WHERE id = p_id; END IF;
  INSERT INTO system_logs (modulo, acao, mensagem, payload, user_id)
  VALUES ('pix-automatico-grupo', 'reserva_liberada', coalesce(p_motivo, 'baixa manual'), jsonb_build_object('tabela', p_tabela, 'id', p_id, 'grupo', v_grupo, 'ciclo', c.id, 'ciclo_status', c.status, 'imediata', im.id), auth.uid());
  IF c.status IN ('enviado','agendado','reservado') THEN
    PERFORM public.fn_pix_aut_avisar_equipe('Pix Automático: reserva liberada com cobrança já no Inter',
      'A cobrança de ' || to_char(c.vencimento, 'DD/MM/YYYY') || ' pode já estar no Inter. Cancelar no Inter ou estornar se o débito acontecer.', v_aluno, 'alta');
  END IF;
  RETURN jsonb_build_object('ok', true, 'acao', 'liberada', 'ja_no_inter', coalesce(c.status IN ('enviado','agendado','reservado'), false) OR im.id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_liberar_reserva(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_liberar_reserva(text, uuid, text) TO authenticated;
