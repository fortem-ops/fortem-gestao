-- Reversão: só funciona se nenhuma mensalidade manual tiver sido cobrada.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.planos_2027_mensalidades WHERE venda_origem_id IS NOT NULL AND (status <> 'pendente' OR tentativas > 0)) THEN
    RAISE EXCEPTION 'Reversão abortada: há mensalidade manual já processada';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_cobranca_manual_sync_mensalidade ON public.cobrancas;

DROP TRIGGER IF EXISTS trg_contrato_manual_sync_mensalidades ON public.contratos;

SELECT set_config('fortem.espelho_2027','on',true);

CREATE TEMP TABLE _cob_rb AS SELECT cobranca_id FROM public.planos_2027_mensalidades m WHERE venda_origem_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.planos_catalogo pc JOIN public.contratos k ON k.catalogo_id = pc.id WHERE k.id = m.contrato_id AND pc.familia = 'start_2027');

DELETE FROM public.planos_2027_mensalidades WHERE venda_origem_id IS NOT NULL;

DELETE FROM public.cobrancas WHERE id IN (SELECT cobranca_id FROM _cob_rb) AND status = 'pendente';

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_validar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rede_tokenizacoes t WHERE t.id = NEW.tokenizacao_id AND t.proposta_id = NEW.proposta_id) THEN
    RAISE EXCEPTION 'token não pertence à proposta';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.proposta_id <> OLD.proposta_id OR NEW.competencia <> OLD.competencia
      OR NEW.valor_centavos <> OLD.valor_centavos OR NEW.numero <> OLD.numero) THEN
    RAISE EXCEPTION 'campos imutáveis';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' AND NEW.status NOT IN ('pago', 'estornado') THEN
    RAISE EXCEPTION 'mensalidade paga não muda de status';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'estornado' AND NEW.status <> 'estornado' THEN
    RAISE EXCEPTION 'mensalidade estornada não muda de status';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_espelho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_aluno uuid; v_orig text; v_st text; v_pag date; v_gw text; v_tid text; v_desc text; v_id uuid;
BEGIN
  IF NEW.contrato_id IS NULL AND TG_OP = 'INSERT' THEN
    SELECT m.contrato_id INTO NEW.contrato_id FROM public.planos_2027_mensalidades m
     WHERE m.proposta_id = NEW.proposta_id AND m.contrato_id IS NOT NULL ORDER BY m.numero DESC LIMIT 1;
  END IF;
  IF NEW.contrato_id IS NULL THEN RETURN NEW; END IF;
  SELECT aluno_id INTO v_aluno FROM public.contratos WHERE id = NEW.contrato_id;
  v_orig := CASE WHEN coalesce((SELECT teste_admin FROM public.propostas_planos_2027 WHERE id = NEW.proposta_id), false)
                   OR public.fn_checkout_2027_teste(NEW.proposta_id) THEN 'teste_2027' ELSE 'site_2027' END;
  v_st := CASE NEW.status WHEN 'pago' THEN 'pago' WHEN 'cancelado' THEN 'cancelado'
            WHEN 'estornado' THEN 'estornado' WHEN 'recusado' THEN 'atrasado' WHEN 'inadimplente' THEN 'atrasado' ELSE 'pendente' END;
  IF NEW.status IN ('pago', 'estornado') THEN
    v_pag := (coalesce(NEW.pago_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
    v_gw := CASE NEW.baixa_manual_forma WHEN 'pix' THEN 'inter_pix' WHEN 'dinheiro' THEN 'dinheiro' ELSE 'rede' END;
    v_tid := coalesce((SELECT pr.tid FROM public.pagamentos_rede pr WHERE pr.mensalidade_2027_id = NEW.id AND pr.status = 'approved' ORDER BY pr.created_at DESC LIMIT 1), NEW.tid);
  END IF;
  v_desc := 'Mensalidade ' || NEW.numero || CASE WHEN (SELECT familia FROM public.propostas_planos_2027 WHERE id = NEW.proposta_id) = 'start_2027' THEN '' ELSE '/12' END
    || ' — assinatura do site';
  PERFORM set_config('fortem.espelho_2027', 'on', true);
  IF NEW.cobranca_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.cobrancas WHERE id = NEW.cobranca_id) THEN
    UPDATE public.cobrancas SET contrato_id = NEW.contrato_id, aluno_id = v_aluno, status = v_st, data_pagamento = v_pag,
      gateway = v_gw, tid = v_tid, tentativas = NEW.tentativas, motivo_recusa = CASE WHEN v_st = 'atrasado' THEN left(NEW.motivo, 120) END,
      origem = v_orig
     WHERE id = NEW.cobranca_id
       AND (contrato_id, aluno_id, status, data_pagamento, gateway, tid, tentativas, origem)
           IS DISTINCT FROM (NEW.contrato_id, v_aluno, v_st, v_pag, v_gw, v_tid, NEW.tentativas::int, v_orig);
  ELSE
    INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, data_pagamento, status,
      forma_pagamento, meio_registro, gateway, tid, tentativas, descricao, composicao, origem, mensalidade_2027_id)
    VALUES (NEW.contrato_id, v_aluno, NEW.numero, NEW.valor_centavos / 100.0, NEW.vencimento, v_pag, v_st,
      'cartao_recorrencia', 'site_2027', v_gw, v_tid, NEW.tentativas, v_desc,
      jsonb_build_object('plano', NEW.valor_centavos / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb), v_orig, NEW.id)
    ON CONFLICT (mensalidade_2027_id) WHERE mensalidade_2027_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
    NEW.cobranca_id := coalesce(v_id, (SELECT id FROM public.cobrancas WHERE mensalidade_2027_id = NEW.id));
  END IF;
  PERFORM set_config('fortem.espelho_2027', 'off', true);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_devidas(p_hoje date, p_limite integer DEFAULT 50)
 RETURNS SETOF planos_2027_mensalidades
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.* FROM planos_2027_mensalidades m
  JOIN rede_tokenizacoes t ON t.id = m.tokenizacao_id AND t.proposta_id = m.proposta_id AND t.status = 'active'
  JOIN propostas_planos_2027 p ON p.id = m.proposta_id AND p.assinatura_cancelada_em IS NULL
  WHERE EXISTS (SELECT 1 FROM sistema_config c WHERE c.chave = 'planos_recorrencia_ativa' AND replace(c.valor::text,'"','') = 'true')
    AND NOT m.simulado AND m.numero > 1
    AND m.status IN ('pendente','recusado') AND m.tentativas < 3
    AND COALESCE(m.proxima_tentativa_em, m.vencimento) <= p_hoje
  ORDER BY m.vencimento, m.id
  LIMIT LEAST(GREATEST(p_limite, 0), 50);
$function$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_pode_cobrar(p_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_resultado_rede(p_id uuid, p_resultado text, p_tid text, p_nsu text, p_autorizacao text, p_return_code text, p_return_message text, p_motivo text, p_hoje date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m planos_2027_mensalidades;
BEGIN
  SELECT * INTO m FROM planos_2027_mensalidades WHERE id = p_id;
  IF m.id IS NOT NULL AND NOT m.simulado AND m.status IN ('processando','desconhecido') AND p_resultado IN ('aprovado','recusado') THEN
    INSERT INTO pagamentos_rede(proposta_id, mensalidade_2027_id, amount, installments, kind, tid, nsu, authorization_code,
      return_code, return_message, status, idempotency_key)
    VALUES (m.proposta_id, m.id, m.valor_centavos, 1, 'token', left(p_tid,40), left(p_nsu,40), left(p_autorizacao,20),
      left(p_return_code,10), left(regexp_replace(coalesce(p_return_message,''), '\d{5,}', '', 'g'),120),
      CASE WHEN p_resultado = 'aprovado' THEN 'approved' ELSE 'denied' END,
      'planos_mensal:' || m.id || ':' || coalesce(m.referencia, m.tentativas::text))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN public.fn_recorrencia_2027_resultado(p_id, p_resultado, p_tid, p_motivo, p_hoje);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_resultado(p_id uuid, p_resultado text, p_tid text, p_motivo text, p_hoje date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_inadimplente_aviso(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_fim_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

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
  v_venda uuid; v_plano uuid; v_contrato uuid; v_site boolean; v_m public.planos_2027_mensalidades;
  v_desc numeric := 0; v_cob numeric;
BEGIN
  SELECT * INTO pl FROM public.planos WHERE id = p_plano FOR UPDATE;
  IF NOT FOUND OR NOT pl.ativo OR NOT COALESCE(pl.renovacao_automatica, false) THEN
    RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'plano inativo ou sem renovação automática');
  END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = pl.catalogo_id AND familia = 'start_2027';
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
     WHERE x.proposta_id = (SELECT x2.proposta_id FROM public.planos_2027_mensalidades x2 JOIN public.contratos k3 ON k3.id = x2.contrato_id WHERE k3.plano_id = pl.id LIMIT 1)
       AND abs(x.vencimento - pl.proxima_renovacao) <= 15
     ORDER BY abs(x.vencimento - pl.proxima_renovacao), x.numero DESC LIMIT 1;
    IF v_m.id IS NULL OR v_m.status <> 'pago' THEN
      RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'aguardando mensalidade do site');
    END IF;
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
    'recorrencia', CASE WHEN v_site THEN 'online' ELSE 'manual' END, CASE WHEN v_teste THEN 'teste_2027' WHEN v_site THEN 'site_2027' ELSE 'renovacao_automatica' END, v_idem, NULL)
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
    parcelas, status, criado_por, servicos_inclusos, catalogo_id, observacoes)
  VALUES (pl.aluno_id, v_plano, c.familia, k.frequencia_semanal, COALESCE(c.quantidade_creditos, 0),
    'mensal', v_ini, v_fim, COALESCE(k.forma_pagamento, 'cartao_recorrencia'), pl.valor, v_cob, 0,
    1, 'ativo', k.criado_por, '{}'::jsonb, c.id, CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_contrato;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato, COALESCE(c.quantidade_creditos, 0), v_ini, (v_fim - 1), 'ativo');

  IF v_site THEN
    UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE proposta_id = v_m.proposta_id AND numero >= v_m.numero;
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
$function$;

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
      JOIN public.propostas_planos_2027 pp ON pp.id = m.proposta_id AND pp.familia = 'start_2027' AND (pp.aluno_id = r.aluno_id OR pp.aluno_ativado_id = r.aluno_id)
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
    WHERE x.numero_ciclo < 100 AND x.mensalidade_2027_id IS NULL AND x.status IN ('pendente', 'atrasado') AND x.data_vencimento + v_tol < p_data
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

CREATE OR REPLACE FUNCTION public.fn_manual_primeiro_ciclo_liquidar(p_venda_id uuid, p_pagamento_id uuid, p_resultado jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.vendas; c public.cobrancas; pr public.pagamentos_rede; k public.contratos; n int; pago_em date; ja boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:'||p_venda_id::text,0));
 SELECT * INTO v FROM public.vendas WHERE id=p_venda_id FOR UPDATE;
 IF v.id IS NULL OR v.origem IS DISTINCT FROM 'manual' OR v.tipo_cobranca IS DISTINCT FROM 'recorrencia' OR v.status_pagamento IN ('cancelado','estornado') THEN RAISE EXCEPTION 'Venda manual recorrente inválida'; END IF;
 SELECT count(*) INTO n FROM public.contratos WHERE plano_id=v.plano_id AND aluno_id=v.aluno_id AND forma_pagamento='cartao_recorrencia';
 IF n<>1 THEN RAISE EXCEPTION 'Contrato do primeiro ciclo ausente ou ambíguo'; END IF;
 SELECT * INTO k FROM public.contratos WHERE plano_id=v.plano_id AND aluno_id=v.aluno_id AND forma_pagamento='cartao_recorrencia';
 SELECT count(*) INTO n FROM public.cobrancas WHERE contrato_id=k.id AND numero_ciclo=1 AND aluno_id=v.aluno_id;
 IF n<>1 THEN RAISE EXCEPTION 'Cobrança do primeiro ciclo ausente ou ambígua'; END IF;
 SELECT * INTO c FROM public.cobrancas WHERE contrato_id=k.id AND numero_ciclo=1 AND aluno_id=v.aluno_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('manual_cobranca:'||c.id::text,0));
 SELECT * INTO pr FROM public.pagamentos_rede WHERE id=p_pagamento_id FOR UPDATE;
 IF pr.id IS NULL OR pr.venda_id IS DISTINCT FROM v.id OR pr.amount IS DISTINCT FROM round(c.valor*100)::integer OR pr.amount<=0
   OR (pr.cobranca_id IS NOT NULL AND pr.cobranca_id<>c.id) OR (v.cobranca_id IS NOT NULL AND v.cobranca_id<>c.id)
   OR c.status NOT IN ('pendente','atrasado','pago') OR k.status IS DISTINCT FROM 'ativo'
 THEN RAISE EXCEPTION 'Pagamento, aluno, contrato ou valor divergente'; END IF;
 IF EXISTS (SELECT 1 FROM public.pagamentos_rede WHERE id<>pr.id AND status IN ('approved','pending') AND (cobranca_id=c.id OR venda_id=v.id)) THEN RAISE EXCEPTION 'Outro pagamento aprovado ou pendente para o ciclo'; END IF;
 SELECT count(*) INTO n FROM public.ciclos_credito WHERE contrato_id=k.id;
 IF n<>1 OR EXISTS(SELECT 1 FROM public.ciclos_credito WHERE contrato_id=k.id AND cobranca_id IS NOT NULL AND cobranca_id<>c.id) THEN RAISE EXCEPTION 'Ciclo de créditos ausente ou ambíguo'; END IF;
 IF p_resultado IS NOT NULL AND pr.status<>'approved' THEN
  IF pr.status<>'pending' OR p_resultado->>'return_code' IS DISTINCT FROM '00' OR NULLIF(p_resultado->>'tid','') IS NULL THEN RAISE EXCEPTION 'Resultado aprovado inválido'; END IF;
  UPDATE public.pagamentos_rede SET status='approved',tid=p_resultado->>'tid',nsu=p_resultado->>'nsu',authorization_code=p_resultado->>'authorization_code',return_code='00',return_message=p_resultado->>'return_message',raw_response=p_resultado->'raw_response' WHERE id=pr.id RETURNING * INTO pr;
 END IF;
 IF pr.status IS DISTINCT FROM 'approved' OR pr.return_code IS DISTINCT FROM '00' OR NULLIF(pr.tid,'') IS NULL THEN RAISE EXCEPTION 'Pagamento não aprovado'; END IF;
 IF p_resultado IS NOT NULL AND pr.tid IS DISTINCT FROM p_resultado->>'tid' THEN RAISE EXCEPTION 'TID divergente'; END IF;
 IF c.status='pago' AND c.tid IS NOT NULL AND c.tid<>pr.tid THEN RAISE EXCEPTION 'Cobrança paga com outro TID'; END IF;
 pago_em:=(pr.created_at AT TIME ZONE 'America/Sao_Paulo')::date;
 ja:=c.status='pago' AND c.tid=pr.tid AND pr.cobranca_id=c.id AND v.cobranca_id=c.id AND EXISTS(SELECT 1 FROM public.ciclos_credito WHERE contrato_id=k.id AND cobranca_id=c.id);
 IF NOT ja THEN
  UPDATE public.pagamentos_rede SET cobranca_id=c.id WHERE id=pr.id;
  UPDATE public.cobrancas SET status='pago',data_pagamento=pago_em,gateway='Rede',tid=pr.tid WHERE id=c.id;
  UPDATE public.vendas SET cobranca_id=c.id,status_pagamento='pago' WHERE id=v.id;
  UPDATE public.ciclos_credito SET cobranca_id=c.id WHERE contrato_id=k.id;
  UPDATE public.pagamento_parcelas pp SET status='pago',data_pagamento=pago_em FROM public.pagamentos pg WHERE pp.pagamento_id=pg.id AND pg.venda_id=v.id AND pp.status='pendente';
  INSERT INTO public.system_logs(modulo,acao,mensagem,payload) VALUES ('cobrancas','manual_primeiro_ciclo_liquidado','Primeiro ciclo manual conciliado atomicamente; sem novos créditos',jsonb_build_object('venda_id',v.id,'cobranca_id',c.id,'pagamento_id',pr.id,'tid',pr.tid,'nsu',pr.nsu,'valor_centavos',pr.amount));
 END IF;
 RETURN jsonb_build_object('handled',true,'success',true,'idempotente',ja,'tid',pr.tid,'pagamento_id',pr.id,'cobranca_id',c.id,'valor_centavos',pr.amount);
END $function$;

DROP FUNCTION IF EXISTS public.fn_cobranca_manual_sync_mensalidade();

DROP FUNCTION IF EXISTS public.fn_contrato_manual_sync_mensalidades();

DROP FUNCTION IF EXISTS public.fn_mensalidade_manual_gerar(uuid);

DROP FUNCTION IF EXISTS public.fn_mensalidade_manual_proximo(uuid);

DROP FUNCTION IF EXISTS public.fn_mensalidade_manual_cobravel(uuid);

ALTER TABLE public.planos_2027_mensalidades DROP CONSTRAINT IF EXISTS planos_2027_mensalidades_manual_vinculos;

ALTER TABLE public.planos_2027_mensalidades DROP CONSTRAINT IF EXISTS planos_2027_mensalidades_origem_unica;

DROP INDEX IF EXISTS public.planos_2027_mensalidades_manual_numero_uidx;

DROP INDEX IF EXISTS public.planos_2027_mensalidades_manual_comp_uidx;

COMMENT ON COLUMN public.planos_2027_mensalidades.venda_origem_id IS 'DEPRECATED: recorrência manual revertida';

ALTER TABLE public.planos_2027_mensalidades ALTER COLUMN proposta_id SET NOT NULL;
