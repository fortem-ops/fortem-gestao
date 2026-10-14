ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS origem text, ADD COLUMN IF NOT EXISTS mensalidade_2027_id uuid;
COMMENT ON COLUMN public.cobrancas.origem IS 'NULL = legado; site_2027 = compra do /planos; teste_2027 = teste (fora de totais)';
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_mensalidade_2027_uidx ON public.cobrancas(mensalidade_2027_id) WHERE mensalidade_2027_id IS NOT NULL;
ALTER TABLE public.planos_2027_mensalidades ADD COLUMN IF NOT EXISTS cobranca_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS planos_2027_mensalidades_cobranca_uidx ON public.planos_2027_mensalidades(cobranca_id) WHERE cobranca_id IS NOT NULL;
UPDATE public.cobrancas SET origem = 'teste_2027' WHERE origem IS NULL AND contrato_id IN (SELECT id FROM public.contratos WHERE observacoes LIKE 'TESTE 2027%');

CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_espelho()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
            WHEN 'recusado' THEN 'atrasado' WHEN 'inadimplente' THEN 'atrasado' ELSE 'pendente' END;
  IF NEW.status = 'pago' THEN
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
REVOKE ALL ON FUNCTION public.fn_mensalidade_2027_espelho() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_mensalidade_2027_zz_espelho ON public.planos_2027_mensalidades;
CREATE TRIGGER trg_mensalidade_2027_zz_espelho BEFORE INSERT OR UPDATE ON public.planos_2027_mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_mensalidade_2027_espelho();

CREATE OR REPLACE FUNCTION public.fn_cobranca_espelho_2027_guarda()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.mensalidade_2027_id IS NOT NULL AND coalesce(current_setting('fortem.espelho_2027', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Mensalidade da assinatura do site: altere pela tela de propostas do site';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_cobranca_espelho_2027_guarda ON public.cobrancas;
CREATE TRIGGER trg_cobranca_espelho_2027_guarda BEFORE UPDATE OR DELETE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.fn_cobranca_espelho_2027_guarda();

CREATE OR REPLACE FUNCTION public.fn_notificar_venda_paga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (NEW.origem = 'site_2027' OR (NEW.origem = 'teste_2027' AND NEW.canal_pagamento = 'online')) then return NEW; end if;
  if NEW.status_pagamento = 'pago'
     and (TG_OP = 'INSERT' or OLD.status_pagamento is distinct from 'pago') then
    perform public.fn_call_edge_function('notificar-venda-paga', jsonb_build_object('venda_id', NEW.id));
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_comissao_venda_paga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF (NEW.origem = 'site_2027' OR (NEW.origem = 'teste_2027' AND NEW.canal_pagamento = 'online')) THEN RETURN NEW; END IF;
  IF NEW.status_pagamento = 'pago' AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento) THEN
    FOR r IN
      SELECT DISTINCT p.profissional_id, p.agenda_id
      FROM public.comissionamento_pendencias p
      WHERE p.aluno_id = NEW.aluno_id
        AND p.tipo_pendencia = 'avaliar_experimental'
        AND p.concluido = true
    LOOP
      PERFORM public.fn_tentar_comissao_experimental(NEW.aluno_id, r.profissional_id, r.agenda_id);
    END LOOP;
  END IF;

  -- Cancelamento
  IF NEW.status_pagamento = 'cancelado' AND (TG_OP = 'UPDATE' AND OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento) THEN
    UPDATE public.comissionamentos
    SET status = 'cancelado', observacoes = COALESCE(observacoes,'') || ' [venda cancelada]'
    WHERE aluno_id = NEW.aluno_id AND tipo = 'treino_experimental' AND status NOT IN ('pago','cancelado');
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_inadimplencias_contratos_anteriores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato_novo public.contratos%ROWTYPE;
  v_cobrancas_canceladas uuid[];
BEGIN
  IF NEW.origem IN ('site_2027','teste_2027') THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'pago'
     OR OLD.status IS NOT DISTINCT FROM 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_contrato_novo
    FROM public.contratos
   WHERE id = NEW.contrato_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  WITH elegiveis AS (
    SELECT c_ant.id
      FROM public.cobrancas c_ant
      JOIN public.contratos con_ant
        ON con_ant.id = c_ant.contrato_id
      JOIN public.inadimplencias i
        ON i.cobranca_id = c_ant.id
       AND i.status = 'aberta'
     WHERE con_ant.aluno_id = v_contrato_novo.aluno_id
       AND con_ant.plano_tipo = v_contrato_novo.plano_tipo
       AND con_ant.id <> v_contrato_novo.id
       AND (
         con_ant.data_inicio < v_contrato_novo.data_inicio
         OR (
           con_ant.data_inicio = v_contrato_novo.data_inicio
           AND con_ant.created_at < v_contrato_novo.created_at
         )
       )
       AND con_ant.status IN ('encerrado', 'cancelado')
       AND c_ant.status = 'atrasado'
  ), canceladas AS (
    UPDATE public.cobrancas c
       SET status = 'cancelado'
      FROM elegiveis e
     WHERE c.id = e.id
    RETURNING c.id
  )
  SELECT array_agg(id)
    INTO v_cobrancas_canceladas
    FROM canceladas;

  IF v_cobrancas_canceladas IS NOT NULL THEN
    UPDATE public.inadimplencias
       SET status = 'cancelada',
           data_regularizacao = COALESCE(NEW.data_pagamento, CURRENT_DATE)
     WHERE cobranca_id = ANY(v_cobrancas_canceladas)
       AND status = 'aberta';
  END IF;

  RETURN NEW;
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
  v_venda uuid; v_plano uuid; v_contrato uuid; v_site boolean; m public.planos_2027_mensalidades;
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
  -- Start do site: o ciclo seguinte só existe com a mensalidade paga (planos_2027_mensalidades); sem cobrança pendente nova.
  v_site := EXISTS (SELECT 1 FROM public.planos_2027_mensalidades x JOIN public.contratos k2 ON k2.id = x.contrato_id WHERE k2.plano_id = pl.id);
  IF v_site THEN
    SELECT x.* INTO m FROM public.planos_2027_mensalidades x
     WHERE x.proposta_id = (SELECT x2.proposta_id FROM public.planos_2027_mensalidades x2 JOIN public.contratos k3 ON k3.id = x2.contrato_id WHERE k3.plano_id = pl.id LIMIT 1)
       AND abs(x.vencimento - pl.proxima_renovacao) <= 15
     ORDER BY abs(x.vencimento - pl.proxima_renovacao), x.numero DESC LIMIT 1;
    IF m.id IS NULL OR m.status <> 'pago' THEN
      RETURN jsonb_build_object('plano_id', p_plano, 'pulado', 'aguardando mensalidade do site');
    END IF;
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
    pl.valor, 0, pl.valor, pl.forma_pagamento_padrao, 1, CASE WHEN v_site THEN 'pago' ELSE 'pendente' END::venda_status, v_ini, 'recorrencia', 0,
    'recorrencia', CASE WHEN v_site THEN 'online' ELSE 'manual' END, CASE WHEN v_teste THEN 'teste_2027' WHEN v_site THEN 'site_2027' ELSE 'renovacao_automatica' END, v_idem, NULL)
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

  IF v_site THEN
    UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE proposta_id = m.proposta_id AND numero >= m.numero;
  ELSE
  INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
    forma_pagamento, meio_registro, descricao, composicao)
  VALUES (v_contrato, pl.aluno_id, 1, pl.valor, v_ini, 'pendente', pl.forma_pagamento_padrao, 'manual_admin',
    'Mensalidade ciclo ' || to_char(v_ini, 'DD/MM/YYYY') || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
    jsonb_build_object('plano', pl.valor, 'servicos', 0, 'servicos_vendas', '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object('plano_anterior', pl.id, 'plano_id', v_plano, 'venda_id', v_venda,
    'contrato_id', v_contrato, 'ciclo_inicio', v_ini, 'ciclo_fim', v_fim - 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_previsibilidade_dia_a_dia(p_inicio date, p_fim date)
 RETURNS TABLE(dia date, dia_util boolean, previsto_bruto numeric, previsto_liquido numeric, realizado_bruto numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH dias AS (
    SELECT d::date AS dia FROM generate_series(p_inicio, p_fim, interval '1 day') d
  ),
  previsto AS (
    SELECT data_recebimento_prevista AS dia, sum(valor_bruto) AS bruto, sum(valor_liquido) AS liquido
    FROM (
      SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_mensalidades
      UNION ALL SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_servicos
      UNION ALL SELECT data_recebimento_prevista, valor_bruto, valor_liquido FROM vw_recebiveis_previstos_produtos
    ) t
    WHERE data_recebimento_prevista BETWEEN p_inicio AND p_fim
    GROUP BY 1
  ),
  realizado AS (
    SELECT cb.data_pagamento AS dia, sum(cb.valor) AS bruto
    FROM cobrancas cb JOIN contratos c ON c.id = cb.contrato_id
    WHERE cb.status = 'pago' AND cb.data_pagamento BETWEEN p_inicio AND p_fim
      AND c.plano_tipo NOT IN ('gympass','wellhub','totalpass','outro')
      AND cb.valor > 0 AND cb.origem IS DISTINCT FROM 'teste_2027'
    GROUP BY 1
  )
  SELECT d.dia, fn_fin_eh_dia_util(d.dia), COALESCE(p.bruto,0), COALESCE(p.liquido,0), COALESCE(r.bruto,0)
  FROM dias d
  LEFT JOIN previsto p ON p.dia = d.dia
  LEFT JOIN realizado r ON r.dia = d.dia
  ORDER BY d.dia;
$function$;

CREATE OR REPLACE VIEW public.v_vendas_resumo AS
SELECT v.id AS venda_id,
    v.data_venda,
    date_trunc('month'::text, v.data_venda::timestamp with time zone)::date AS mes,
    v.aluno_id,
    a.nome AS aluno_nome,
    v.tipo,
    v.nome_snapshot AS item,
    v.valor,
    v.desconto,
    v.valor_final,
    v.status_pagamento,
    v.forma_pagamento,
    v.parcelas,
    v.vendedor_id,
    pr.full_name AS vendedor_nome,
    v.plano_id,
    pl.tipo AS plano_tipo,
    pl.duracao_meses,
    a.responsavel_id
   FROM vendas v
     LEFT JOIN alunos a ON a.id = v.aluno_id
     LEFT JOIN profiles pr ON pr.user_id = v.vendedor_id
     LEFT JOIN planos pl ON pl.id = v.plano_id
  WHERE v.origem IS DISTINCT FROM 'teste_2027';

CREATE OR REPLACE VIEW public.v_cancelamentos AS
SELECT v.id AS venda_id,
    v.aluno_id,
    a.nome AS aluno_nome,
    v.data_venda,
    v.data_cancelamento,
    COALESCE(EXTRACT(epoch FROM v.data_cancelamento - v.data_venda::timestamp with time zone) / 86400::numeric, 0::numeric)::integer AS dias_ate_cancelar,
    v.motivo_cancelamento_id,
    m.nome AS motivo_nome,
    m.slug AS motivo_slug,
    v.observacao_cancelamento,
    v.valor_final,
    v.vendedor_id,
    pr.full_name AS vendedor_nome,
    pl.tipo AS plano_tipo,
    a.responsavel_id
   FROM vendas v
     LEFT JOIN alunos a ON a.id = v.aluno_id
     LEFT JOIN cancelamento_motivos m ON m.id = v.motivo_cancelamento_id
     LEFT JOIN profiles pr ON pr.user_id = v.vendedor_id
     LEFT JOIN planos pl ON pl.id = v.plano_id
  WHERE v.status_pagamento = 'cancelado'::venda_status AND v.origem IS DISTINCT FROM 'teste_2027';

CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_mensalidades AS
WITH base AS (
         SELECT cb.id AS cobranca_id,
            cb.contrato_id,
            cb.aluno_id,
            a.nome AS aluno_nome,
            cb.valor AS valor_bruto,
            cb.data_vencimento,
            cb.status AS status_cobranca,
            c.plano_tipo,
            c.forma_pagamento,
            c.cartao_token_id,
            'rede'::text AS adquirente
           FROM cobrancas cb
             JOIN contratos c ON c.id = cb.contrato_id
             JOIN alunos a ON a.id = cb.aluno_id
          WHERE (cb.status = ANY (ARRAY['pendente'::text, 'atrasado'::text])) AND cb.valor > 0::numeric AND cb.origem IS DISTINCT FROM 'teste_2027' AND c.status = 'ativo'::text AND (c.plano_tipo <> ALL (ARRAY['gympass'::text, 'wellhub'::text, 'totalpass'::text, 'outro'::text]))
        ), bandeira_detectada AS (
         SELECT b.cobranca_id,
            b.contrato_id,
            b.aluno_id,
            b.aluno_nome,
            b.valor_bruto,
            b.data_vencimento,
            b.status_cobranca,
            b.plano_tipo,
            b.forma_pagamento,
            b.cartao_token_id,
            b.adquirente,
            COALESCE(lower(
                CASE
                    WHEN cs.brand ~~* 'master%'::text THEN 'mastercard'::text
                    ELSE cs.brand
                END), cfg.bandeira_padrao) AS bandeira,
            cs.id IS NOT NULL AS bandeira_de_cartao_salvo
           FROM base b
             LEFT JOIN cartoes_salvos cs ON cs.id = b.cartao_token_id AND cs.ativo = true
             LEFT JOIN adquirentes_config cfg ON cfg.adquirente = b.adquirente
        ), com_taxa AS (
         SELECT bd.cobranca_id,
            bd.contrato_id,
            bd.aluno_id,
            bd.aluno_nome,
            bd.valor_bruto,
            bd.data_vencimento,
            bd.status_cobranca,
            bd.plano_tipo,
            bd.forma_pagamento,
            bd.cartao_token_id,
            bd.adquirente,
            bd.bandeira,
            bd.bandeira_de_cartao_salvo,
            COALESCE(t.taxa_percentual, t2.taxa_percentual, 0::numeric) AS taxa_percentual,
            COALESCE(t.prazo_recebimento_dias, t2.prazo_recebimento_dias, 0) AS prazo_recebimento_dias,
            COALESCE(t.prazo_unidade, t2.prazo_unidade, 'corridos'::text) AS prazo_unidade,
            t.id IS NULL AS taxa_via_bandeira_padrao
           FROM bandeira_detectada bd
             LEFT JOIN adquirentes_taxas t ON t.adquirente = bd.adquirente AND t.bandeira = bd.bandeira AND t.modalidade = 'credito_vista'::adquirente_modalidade
             LEFT JOIN adquirentes_config cfg2 ON cfg2.adquirente = bd.adquirente
             LEFT JOIN adquirentes_taxas t2 ON t2.adquirente = bd.adquirente AND t2.bandeira = cfg2.bandeira_padrao AND t2.modalidade = 'credito_vista'::adquirente_modalidade
        )
 SELECT cobranca_id,
    contrato_id,
    aluno_id,
    aluno_nome,
    'mensalidade'::text AS origem,
    plano_tipo,
    adquirente,
    bandeira,
    bandeira_de_cartao_salvo,
    taxa_via_bandeira_padrao,
    forma_pagamento,
    status_cobranca,
    valor_bruto,
    taxa_percentual,
    round(valor_bruto * (1::numeric - taxa_percentual / 100.0), 2) AS valor_liquido,
    data_vencimento,
    prazo_recebimento_dias,
    prazo_unidade,
        CASE
            WHEN prazo_unidade = 'uteis'::text THEN fn_fin_somar_dias_uteis(data_vencimento, prazo_recebimento_dias)
            ELSE fn_fin_proximo_dia_util(data_vencimento + prazo_recebimento_dias)
        END AS data_recebimento_prevista
   FROM com_taxa;

CREATE OR REPLACE VIEW public.vw_recebiveis_previstos_servicos AS
WITH base AS (
         SELECT v.id AS venda_id,
            v.aluno_id,
            a.nome AS aluno_nome,
            v.nome_snapshot,
            v.data_venda,
            COALESCE(v.valor_final, v.valor) AS valor_total,
            GREATEST(COALESCE(v.parcelas, 1), 1) AS parcelas,
            COALESCE(v.forma_pagamento, 'cartao_credito'::text) AS forma_pagamento,
            v.forma_pagamento IS NULL AS forma_pagamento_assumida,
            'rede'::text AS adquirente
           FROM vendas v
             JOIN alunos a ON a.id = v.aluno_id
          WHERE v.tipo = 'servico'::venda_tipo AND v.origem IS DISTINCT FROM 'teste_2027' AND v.status_pagamento::text = 'pendente'::text AND COALESCE(v.valor_final, v.valor) > 0::numeric AND (COALESCE(v.forma_pagamento, ''::text) <> ALL (ARRAY['jessica_elkfury'::text, 'julia_assis_brasil'::text]))
        ), expandido AS (
         SELECT b.venda_id,
            b.aluno_id,
            b.aluno_nome,
            b.nome_snapshot,
            b.data_venda,
            b.valor_total,
            b.parcelas,
            b.forma_pagamento,
            b.forma_pagamento_assumida,
            b.adquirente,
            n.n AS numero_parcela,
            (b.data_venda + (((n.n - 1) || ' months'::text)::interval))::date AS data_cobranca,
            round(b.valor_total / b.parcelas::numeric, 2) AS valor_parcela,
                CASE
                    WHEN b.forma_pagamento = 'cartao_debito'::text THEN 'debito'::text
                    WHEN b.parcelas = 1 THEN 'credito_vista'::text
                    WHEN b.parcelas >= 2 AND b.parcelas <= 6 THEN 'credito_2_6x'::text
                    ELSE 'credito_7_12x'::text
                END AS modalidade
           FROM base b
             CROSS JOIN LATERAL generate_series(1, b.parcelas) n(n)
        ), com_taxa AS (
         SELECT e.venda_id,
            e.aluno_id,
            e.aluno_nome,
            e.nome_snapshot,
            e.data_venda,
            e.valor_total,
            e.parcelas,
            e.forma_pagamento,
            e.forma_pagamento_assumida,
            e.adquirente,
            e.numero_parcela,
            e.data_cobranca,
            e.valor_parcela,
            e.modalidade,
            cfg.bandeira_padrao AS bandeira,
                CASE
                    WHEN e.forma_pagamento = ANY (ARRAY['cartao_credito'::text, 'cartao_debito'::text]) THEN COALESCE(t.taxa_percentual, 0::numeric)
                    ELSE COALESCE(mp.taxa_percentual, 0::numeric)
                END AS taxa_percentual,
                CASE
                    WHEN e.forma_pagamento = ANY (ARRAY['cartao_credito'::text, 'cartao_debito'::text]) THEN COALESCE(t.prazo_recebimento_dias, 0)
                    ELSE COALESCE(mp.prazo_recebimento_dias, 0)
                END AS prazo_recebimento_dias,
                CASE
                    WHEN e.forma_pagamento = ANY (ARRAY['cartao_credito'::text, 'cartao_debito'::text]) THEN COALESCE(t.prazo_unidade, 'corridos'::text)
                    ELSE COALESCE(mp.prazo_unidade, 'uteis'::text)
                END AS prazo_unidade
           FROM expandido e
             LEFT JOIN adquirentes_config cfg ON cfg.adquirente = e.adquirente
             LEFT JOIN adquirentes_taxas t ON t.adquirente = e.adquirente AND t.bandeira = cfg.bandeira_padrao AND t.modalidade = e.modalidade::adquirente_modalidade
             LEFT JOIN meios_pagamento_config mp ON mp.meio = e.forma_pagamento AND (e.forma_pagamento = ANY (ARRAY['pix'::text, 'boleto'::text, 'dinheiro'::text]))
        )
 SELECT venda_id,
    aluno_id,
    aluno_nome,
    'servico'::text AS origem,
    nome_snapshot AS descricao,
    adquirente,
    bandeira,
    forma_pagamento,
    forma_pagamento_assumida,
    numero_parcela,
    parcelas AS total_parcelas,
    valor_parcela AS valor_bruto,
    taxa_percentual,
    round(valor_parcela * (1::numeric - taxa_percentual / 100.0), 2) AS valor_liquido,
    data_cobranca AS data_vencimento,
    prazo_recebimento_dias,
    prazo_unidade,
        CASE
            WHEN prazo_unidade = 'uteis'::text THEN fn_fin_somar_dias_uteis(data_cobranca, prazo_recebimento_dias)
            ELSE fn_fin_proximo_dia_util(data_cobranca + prazo_recebimento_dias)
        END AS data_recebimento_prevista
   FROM com_taxa;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ativar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r public.propostas_planos_2027; c public.planos_catalogo; ac public.propostas_2027_aceites;
  v_teste boolean; v_aluno uuid; v_vinc text; v_cnt int; v_forma text; v_servs jsonb; v_res jsonb;
  v_ini date; v_ct jsonb; v_contrato uuid; v_venda uuid; v_status text;
  v_orig text; v_gw text; v_tid text; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_encerrados int := 0; v_pl record;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF r.ativada_em IS NOT NULL THEN
    RETURN jsonb_build_object('ja_ativada', true, 'venda_id', r.venda_id, 'contrato_id', r.contrato_id, 'aluno_id', r.aluno_ativado_id);
  END IF;
  IF r.pago_em IS NULL THEN RAISE EXCEPTION 'Proposta sem pagamento confirmado'; END IF;
  v_teste := r.teste_admin OR public.fn_checkout_2027_teste(r.id);
  v_ct := coalesce(r.contratante, '{}'::jsonb);

  IF v_teste THEN
    SELECT a.id INTO v_aluno FROM public.alunos a, public.sistema_config sc
     WHERE a.nome = 'NICOLAS TESTE' AND sc.chave = 'vendas_2027_teste_aluno_ids' AND sc.valor ? a.id::text
     ORDER BY a.created_at LIMIT 1;
    IF v_aluno IS NULL THEN RAISE EXCEPTION 'Cadastro de teste não encontrado'; END IF;
    v_vinc := 'teste';
  ELSIF r.aluno_id IS NOT NULL AND r.verificacao_id IS NOT NULL THEN
    v_aluno := r.aluno_id; v_vinc := 'verificado';
  ELSIF r.cpf_hash IS NOT NULL AND EXISTS (SELECT 1 FROM public.alunos WHERE cpf_hash = r.cpf_hash) THEN
    SELECT count(*), min(id::text)::uuid INTO v_cnt, v_aluno FROM public.alunos WHERE cpf_hash = r.cpf_hash;
    IF v_cnt > 1 THEN RAISE EXCEPTION 'CPF em mais de um cadastro: vincular manualmente'; END IF;
    v_vinc := 'cpf';
  ELSE
    IF r.cpf_hash IS NULL THEN RAISE EXCEPTION 'Proposta sem CPF do contratante'; END IF;
    INSERT INTO public.alunos (nome, email, telefone, data_nascimento, status, cep, logradouro, numero, complemento,
      bairro, cidade, uf, rg, cpf_hash, cpf_ultimos3, observacoes)
    VALUES (coalesce(nullif(v_ct->>'nome',''), r.nome), coalesce(nullif(v_ct->>'email',''), r.email), r.whatsapp,
      nullif(v_ct->>'data_nascimento','')::date, 'ativo', v_ct->>'cep', v_ct->>'logradouro', v_ct->>'numero',
      v_ct->>'complemento', v_ct->>'bairro', v_ct->>'cidade', v_ct->>'uf', nullif(v_ct->>'rg',''),
      r.cpf_hash, r.cpf_ultimos3, 'Cadastro criado pela compra no site (/planos)')
    RETURNING id INTO v_aluno;
    v_vinc := 'novo';
  END IF;

  IF NOT v_teste THEN
    SELECT status INTO v_status FROM public.alunos WHERE id = v_aluno;
    IF v_status IS DISTINCT FROM 'ativo' THEN UPDATE public.alunos SET status = 'ativo' WHERE id = v_aluno; END IF;
  END IF;

  SELECT * INTO c FROM public.planos_catalogo WHERE codigo = r.plano_codigo AND versao = 2027;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item 2027 da proposta não encontrado'; END IF;
  SELECT coalesce(jsonb_agg(sc.id ORDER BY x.ord), '[]'::jsonb), count(*) INTO v_servs, v_cnt
    FROM unnest(coalesce(r.servicos_codigos, ARRAY[]::text[])) WITH ORDINALITY x(cod, ord)
    JOIN public.servicos_catalogo sc ON sc.codigo = x.cod AND sc.versao = 2027;
  IF v_cnt <> coalesce(array_length(r.servicos_codigos, 1), 0) THEN RAISE EXCEPTION 'Serviço 2027 da proposta não encontrado'; END IF;

  v_forma := CASE WHEN r.pagamento_tipo = 'pix' THEN 'pix_vista' ELSE r.forma_plano END;
  v_ini := (r.pago_em AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Plano antigo: só encerra se a data final do contrato (ou do plano, sem contrato) já chegou.
  -- Com contrato vigente o aluno fica com 2 planos ativos. Cobranças/mensalidades do antigo não são tocadas.
  FOR v_pl IN
    SELECT p.id FROM public.planos p
     WHERE p.aluno_id = v_aluno AND p.ativo AND p.atividade = 'treinamento_funcional'
       AND coalesce((SELECT k.data_fim FROM public.contratos k WHERE k.plano_id = p.id ORDER BY k.created_at DESC LIMIT 1), p.data_fim) <= v_hoje
  LOOP
    UPDATE public.contratos SET status = 'encerrado',
      observacoes = coalesce(observacoes || ' | ', '') || 'Encerrado: fim do contrato, nova compra no site em ' || v_hoje
     WHERE plano_id = v_pl.id AND status IN ('ativo', 'suspenso');
    UPDATE public.planos SET ativo = false WHERE id = v_pl.id;
    v_encerrados := v_encerrados + 1;
  END LOOP;

  v_res := public.fn_venda_2027_gravar(jsonb_build_object(
      'aluno_id', v_aluno, 'catalogo_id', c.id, 'forma', v_forma,
      'parcelas', coalesce(r.pagamento_parcelas, r.parcelas_plano, 1),
      'servicos', v_servs, 'forma_servicos', coalesce(r.forma_servicos, 'pix_vista'),
      'parcelas_servicos', coalesce(r.parcelas_servicos, 1),
      'data_inicio', v_ini, 'idempotency_key', 'planos:' || r.id,
      'observacoes', 'Venda do site /planos — proposta ' || left(r.id::text, 8)),
    NULL, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END, 'online', v_forma = 'recorrencia');

  v_venda := (v_res->>'venda_id')::uuid;
  v_contrato := coalesce((v_res->>'contrato_id')::uuid, (SELECT k.id FROM public.contratos k JOIN public.vendas v ON v.plano_id = k.plano_id WHERE v.id = v_venda ORDER BY k.created_at DESC LIMIT 1));

  IF r.aceite_id IS NOT NULL THEN
    SELECT * INTO ac FROM public.propostas_2027_aceites WHERE id = r.aceite_id;
    IF FOUND THEN
      INSERT INTO public.contratos_documentos (contrato_id, aluno_id, template_id, template_versao, regulamento_versao,
        conteudo_gerado, variaveis_utilizadas, aceite, data_aceite, formato_aceite, ip_aceite, hash_texto, user_agent, origem, proposta_id)
      VALUES (v_contrato, v_aluno, ac.template_id, ac.template_versao, ac.regulamento_versao, ac.conteudo_html,
        ac.variaveis, true, ac.aceito_em, 'site', ac.ip, ac.hash_texto, ac.user_agent,
        CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END, r.id)
      ON CONFLICT (proposta_id) WHERE proposta_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  v_orig := CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END;
  IF v_forma = 'recorrencia' THEN
    -- Espelho em cobrancas nasce do gatilho da mensalidade ao ganhar o contrato.
    UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE proposta_id = r.id AND contrato_id IS NULL;
  ELSE
    IF r.pagamento_tipo = 'pix' THEN
      v_gw := 'inter_pix';
      SELECT txid INTO v_tid FROM public.pix_cobrancas WHERE proposta_id = r.id AND liquidado_em IS NOT NULL ORDER BY liquidado_em DESC LIMIT 1;
    ELSE
      v_gw := 'rede';
      SELECT tid INTO v_tid FROM public.pagamentos_rede WHERE proposta_id = r.id AND status = 'approved' AND mensalidade_2027_id IS NULL ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF v_tid IS NULL THEN
      SELECT ref INTO v_tid FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND status IN ('aprovado', 'pago') ORDER BY updated_at DESC LIMIT 1;
    END IF;
    UPDATE public.cobrancas SET status = 'pago', data_pagamento = v_ini, gateway = v_gw, tid = v_tid,
      meio_registro = 'site_2027', origem = v_orig
     WHERE contrato_id = v_contrato AND status = 'pendente';
  END IF;
  UPDATE public.vendas SET status_pagamento = 'pago'
   WHERE (id = v_venda OR id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(coalesce(v_res->'servico_venda_ids', '[]'::jsonb)) x))
     AND status_pagamento = 'pendente';

  UPDATE public.propostas_planos_2027 SET aluno_ativado_id = v_aluno, venda_id = v_venda, contrato_id = v_contrato,
    ativada_em = now(), ativacao_vinculo = v_vinc, ativacao_erro = NULL, ativacao_erro_em = NULL,
    aluno_id = CASE WHEN v_teste THEN aluno_id ELSE coalesce(aluno_id, v_aluno) END
  WHERE id = r.id;

  RETURN jsonb_build_object('ativada', true, 'aluno_id', v_aluno, 'vinculo', v_vinc, 'venda_id', v_venda,
    'contrato_id', v_contrato, 'teste', v_teste, 'planos_antigos_encerrados', v_encerrados, 'corrida_pendente', coalesce(r.corrida, false));
END $function$;