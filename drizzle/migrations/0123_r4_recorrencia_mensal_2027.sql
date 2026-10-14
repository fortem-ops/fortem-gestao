ALTER TABLE public.planos_2027_mensalidades
  ADD COLUMN IF NOT EXISTS notificacao_inadimplencia_id uuid,
  ADD COLUMN IF NOT EXISTS baixa_manual_por uuid,
  ADD COLUMN IF NOT EXISTS baixa_manual_forma text;
ALTER TABLE public.propostas_planos_2027
  ADD COLUMN IF NOT EXISTS assinatura_cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_cancelada_por uuid;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_tentativa_limpar_nome()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF NEW.recorrencia AND NEW.status = 'aprovado' AND NOT NEW.simulado THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.planos_2027_mensalidades m WHERE m.tokenizacao_id = NEW.tokenizacao_id) THEN RETURN NEW; END IF;
  UPDATE public.rede_tokenizacoes SET cardholder_name = NULL
   WHERE id = NEW.tokenizacao_id AND proposta_id IS NOT NULL AND aluno_id IS NULL AND cardholder_name IS NOT NULL;
  RETURN NEW;
END $f$;

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_fim_contrato()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF NEW.status NOT IN ('pago','cancelado') THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.planos_2027_mensalidades m WHERE m.proposta_id = NEW.proposta_id AND m.status NOT IN ('pago','cancelado')) THEN RETURN NEW; END IF;
  IF (SELECT familia FROM public.propostas_planos_2027 WHERE id = NEW.proposta_id) = 'start_2027'
     AND NOT EXISTS (SELECT 1 FROM public.planos_2027_mensalidades m WHERE m.proposta_id = NEW.proposta_id AND m.status = 'cancelado')
     AND (SELECT assinatura_cancelada_em FROM public.propostas_planos_2027 WHERE id = NEW.proposta_id) IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.rede_tokenizacoes SET cardholder_name = NULL
   WHERE id = NEW.tokenizacao_id AND proposta_id = NEW.proposta_id AND aluno_id IS NULL AND cardholder_name IS NOT NULL;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_mensalidade_2027_fim_contrato ON public.planos_2027_mensalidades;
CREATE TRIGGER trg_mensalidade_2027_fim_contrato AFTER UPDATE OF status ON public.planos_2027_mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_mensalidade_2027_fim_contrato();

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_devidas(p_hoje date, p_limite integer DEFAULT 50)
 RETURNS SETOF planos_2027_mensalidades LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT m.* FROM planos_2027_mensalidades m
  JOIN rede_tokenizacoes t ON t.id = m.tokenizacao_id AND t.proposta_id = m.proposta_id AND t.status = 'active'
  JOIN propostas_planos_2027 p ON p.id = m.proposta_id AND p.assinatura_cancelada_em IS NULL
  WHERE EXISTS (SELECT 1 FROM sistema_config c WHERE c.chave = 'planos_recorrencia_ativa' AND replace(c.valor::text,'"','') = 'true')
    AND NOT m.simulado AND m.numero > 1
    AND m.status IN ('pendente','recusado') AND m.tentativas < 3
    AND COALESCE(m.proxima_tentativa_em, m.vencimento) <= p_hoje
  ORDER BY m.vencimento, m.id
  LIMIT LEAST(GREATEST(p_limite, 0), 50);
$f$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_devidas_simulacao(p_proposta_id uuid, p_hoje date)
 RETURNS SETOF planos_2027_mensalidades LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT m.* FROM planos_2027_mensalidades m
  JOIN propostas_planos_2027 p ON p.id = m.proposta_id AND p.assinatura_cancelada_em IS NULL
  WHERE m.proposta_id = p_proposta_id AND m.simulado AND m.numero > 1
    AND m.status IN ('pendente','recusado') AND m.tentativas < 3
    AND COALESCE(m.proxima_tentativa_em, m.vencimento) <= p_hoje
  ORDER BY m.vencimento LIMIT 50;
$f$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_incertas(p_simulado boolean, p_proposta_id uuid DEFAULT NULL)
 RETURNS SETOF planos_2027_mensalidades LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT m.* FROM planos_2027_mensalidades m
  WHERE m.simulado = p_simulado AND (p_proposta_id IS NULL OR m.proposta_id = p_proposta_id)
    AND m.referencia IS NOT NULL
    AND (m.status = 'desconhecido' OR (m.status = 'processando' AND m.updated_at < now() - interval '15 minutes'))
  ORDER BY m.updated_at LIMIT 50;
$f$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_pode_cobrar(p_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE m planos_2027_mensalidades; p propostas_planos_2027;
BEGIN
  SELECT * INTO m FROM planos_2027_mensalidades WHERE id = p_id;
  IF m.id IS NULL THEN RETURN 'nao_encontrada'; END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_recorrencia_ativa'),'false') <> 'true' THEN RETURN 'desligado'; END IF;
  IF m.simulado THEN RETURN 'simulado'; END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_ativo'),'false') <> 'true' THEN RETURN 'cartao_real_desligado'; END IF;
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
END $f$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(p_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE m planos_2027_mensalidades; p propostas_planos_2027; v_criador uuid; v_notif uuid; v_teste boolean;
BEGIN
  SELECT * INTO m FROM planos_2027_mensalidades WHERE id = p_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'inadimplente' OR m.notificacao_inadimplencia_id IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM propostas_planos_2027 WHERE id = m.proposta_id;
  SELECT ur.user_id INTO v_criador FROM user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_criador IS NULL THEN RETURN NULL; END IF;
  v_teste := m.simulado OR coalesce(p.teste_admin, false);
  INSERT INTO notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (
    CASE WHEN v_teste THEN '[TESTE] ' ELSE '' END || 'Mensalidade recusada 3 vezes: ' || coalesce(p.nome, 'sem nome'),
    CASE p.familia WHEN 'start_2027' THEN 'Start' WHEN 'power_2027' THEN 'Power' WHEN 'pro_2027' THEN 'Pro' ELSE coalesce(p.familia,'') END
      || ' ' || coalesce(p.frequencia,'') || ' · assinatura no cartão' || E'\n'
      || 'Mensalidade ' || m.numero || ' · vencimento ' || to_char(m.vencimento, 'DD/MM/YYYY') || ' · R$ '
      || translate(to_char(m.valor_centavos::numeric / 100, 'FM999,999,990.00'), ',.', '.,') || E'\n'
      || 'Último motivo: ' || coalesce(m.motivo, '-') || E'\n'
      || 'WhatsApp ' || coalesce(p.whatsapp, '-') || E'\n\n'
      || CASE WHEN v_teste THEN 'Teste: não cobrar nada.'
              WHEN p.familia = 'start_2027' THEN 'Crédito do ciclo não liberado. Ação: falar com o aluno; pagamento manual retoma a assinatura.'
              ELSE 'Créditos do plano mantidos. Ação: falar com o aluno e cobrar a mensalidade.' END,
    'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM user_roles ur WHERE ur.role IN ('admin','coordenador');
  UPDATE planos_2027_mensalidades SET notificacao_inadimplencia_id = v_notif WHERE id = p_id;
  RETURN v_notif;
END $f$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_resultado(p_id uuid, p_resultado text, p_tid text, p_motivo text, p_hoje date)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE r planos_2027_mensalidades; v_status text;
BEGIN
  SELECT * INTO r FROM planos_2027_mensalidades WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR r.status NOT IN ('processando','desconhecido') THEN RETURN 'ignorado'; END IF;
  IF p_resultado = 'aprovado' THEN
    UPDATE planos_2027_mensalidades SET status='pago', tid=left(p_tid,40), motivo=NULL, pago_em=now(), proxima_tentativa_em=NULL WHERE id=p_id;
    PERFORM public.fn_recorrencia_2027_proximo_ciclo(r.proposta_id);
  ELSIF p_resultado = 'recusado' THEN
    UPDATE planos_2027_mensalidades
       SET status = CASE WHEN r.tentativas >= 3 THEN 'inadimplente' ELSE 'recusado' END,
           motivo = left(p_motivo,120),
           proxima_tentativa_em = CASE r.tentativas WHEN 1 THEN p_hoje + 1 WHEN 2 THEN p_hoje + 2 ELSE NULL END
     WHERE id=p_id;
  ELSIF p_resultado = 'desconhecido' THEN
    UPDATE planos_2027_mensalidades SET status='desconhecido', motivo=left(p_motivo,120) WHERE id=p_id;
  ELSE RAISE EXCEPTION 'resultado inválido';
  END IF;
  SELECT status INTO v_status FROM planos_2027_mensalidades WHERE id=p_id;
  IF v_status = 'inadimplente' THEN PERFORM public.fn_recorrencia_2027_inadimplente_aviso(p_id); END IF;
  RETURN v_status;
END $f$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_baixa_manual(p_id uuid, p_forma text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE r planos_2027_mensalidades;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador')) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_forma NOT IN ('pix','cartao','dinheiro') THEN RAISE EXCEPTION 'forma inválida'; END IF;
  SELECT * INTO r FROM planos_2027_mensalidades WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'mensalidade não encontrada'; END IF;
  IF r.status = 'pago' THEN RETURN 'ja_paga'; END IF;
  IF r.status NOT IN ('pendente','recusado','inadimplente') THEN RAISE EXCEPTION 'mensalidade em cobrança ou com resultado incerto'; END IF;
  UPDATE planos_2027_mensalidades SET status='pago', pago_em=now(), proxima_tentativa_em=NULL, tid='MANUAL-' || upper(p_forma),
    baixa_manual_por=auth.uid(), baixa_manual_forma=p_forma WHERE id=p_id;
  PERFORM public.fn_recorrencia_2027_proximo_ciclo(r.proposta_id);
  RETURN 'pago';
END $f$;

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
  IF p.familia = 'start_2027' AND p.aluno_id IS NOT NULL THEN
    UPDATE planos pl SET renovacao_automatica = false
      FROM planos_catalogo c WHERE c.id = pl.catalogo_id AND c.familia = 'start_2027' AND pl.aluno_id = p.aluno_id AND pl.ativo;
  END IF;
  RETURN jsonb_build_object('resultado','cancelada','mensalidades_canceladas', n);
END $f$;

DROP POLICY IF EXISTS "Coordenadores leem mensalidades 2027" ON public.planos_2027_mensalidades;
CREATE POLICY "Coordenadores leem mensalidades 2027" ON public.planos_2027_mensalidades FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'coordenador'));

CREATE OR REPLACE FUNCTION public.fn_creditos_mensais_2027(p_data date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tol int;
  r record; cb record;
  v_i int; v_comp date; v_valid date; v_cred uuid;
  n_start int := 0; n_bota int := 0; n_aguardando int := 0; n_logs int := 0;
  v_mstatus text;
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
    -- Start vendido pelo site (assinatura no cartão): crédito do ciclo só com a mensalidade paga.
    SELECT m.status INTO v_mstatus FROM public.planos_2027_mensalidades m
      JOIN public.propostas_planos_2027 pp ON pp.id = m.proposta_id AND pp.familia = 'start_2027' AND pp.aluno_id = r.aluno_id
     WHERE abs(m.vencimento - r.data_inicio) <= 15
     ORDER BY abs(m.vencimento - r.data_inicio), m.numero DESC LIMIT 1;
    IF FOUND THEN
      IF v_mstatus IS DISTINCT FROM 'pago' THEN
        n_aguardando := n_aguardando + 1;
        CONTINUE;
      END IF;
      SELECT 'pago'::text AS status, NULL::date AS data_vencimento INTO cb;
    ELSE
      cb := NULL;
      SELECT x.status, x.data_vencimento INTO cb FROM public.cobrancas x JOIN public.contratos k ON k.id = x.contrato_id
      WHERE k.plano_id = r.plano_id AND x.numero_ciclo = 1 ORDER BY x.created_at DESC LIMIT 1;
      IF cb.status IS NULL OR NOT (cb.status = 'pago' OR p_data <= cb.data_vencimento + v_tol) THEN
        n_aguardando := n_aguardando + 1;
        CONTINUE;
      END IF;
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
    UPDATE public.creditos_aluno SET ativo = false
    WHERE origem_id = r.venda_id AND atividade = 'Bota de compressão' AND ativo AND competencia < v_comp;
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
$function$;

REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_devidas(date,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_devidas_simulacao(uuid,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_incertas(boolean,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_pode_cobrar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_resultado(uuid,text,text,text,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_mensalidade_2027_fim_contrato() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_devidas(date,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_devidas_simulacao(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_incertas(boolean,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_pode_cobrar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_resultado(uuid,text,text,text,date) TO service_role;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_baixa_manual(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_cancelar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_baixa_manual(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_cancelar(uuid) TO authenticated, service_role;