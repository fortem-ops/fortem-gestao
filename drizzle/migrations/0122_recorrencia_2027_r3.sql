-- R3: 1ª mensalidade da recorrência no cartão + cronograma em planos_2027_mensalidades.
ALTER TABLE public.checkout_2027_tentativas ADD COLUMN IF NOT EXISTS recorrencia boolean NOT NULL DEFAULT false;

-- Recorrência real: chave própria ligada + cartão real ligado + (teste em real_baixo_valor | público com escopo "todos"),
-- sem consultas na mesma proposta (consultas à parte ainda não entram nesta cobrança).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_recorrencia_real(p_proposta_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rev jsonb; v_teste boolean;
BEGIN
  IF public.fn_checkout_2027_cartao_simulado(p_proposta_id) THEN RETURN false; END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_recorrencia_ativa'),'false') <> 'true' THEN RETURN false; END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_ativo'),'false') <> 'true' THEN RETURN false; END IF;
  SELECT revisao INTO v_rev FROM propostas_planos_2027 WHERE id = p_proposta_id;
  IF v_rev->>'forma_plano' IS DISTINCT FROM 'recorrencia' OR coalesce((v_rev->>'servicos_centavos')::int,0) > 0 THEN RETURN false; END IF;
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  IF v_teste THEN
    RETURN coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_pagamento_modo_teste'),'simulacao') = 'real_baixo_valor';
  END IF;
  RETURN coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_escopo'),'teste') = 'todos';
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_real(p_proposta_id uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_modo text; v_flag text; v_escopo text; v_rev jsonb; v_teste boolean;
BEGIN
  IF public.fn_checkout_2027_cartao_simulado(p_proposta_id) THEN RETURN false; END IF;
  SELECT revisao INTO v_rev FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  -- Recorrência tem trava própria (planos_recorrencia_ativa).
  IF v_rev->>'forma_plano' = 'recorrencia' THEN RETURN public.fn_checkout_2027_recorrencia_real(p_proposta_id); END IF;
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT valor #>> '{}' INTO v_flag FROM public.sistema_config WHERE chave = 'planos_cartao_real_ativo';
  SELECT valor #>> '{}' INTO v_escopo FROM public.sistema_config WHERE chave = 'planos_cartao_real_escopo';
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  IF coalesce(v_flag,'false') <> 'true' THEN RETURN false; END IF;
  IF v_teste THEN
    IF coalesce(v_modo,'simulacao') <> 'real_baixo_valor' THEN RETURN false; END IF;
  ELSIF coalesce(v_escopo,'teste') <> 'todos' THEN
    RETURN false;
  END IF;
  RETURN public.fn_checkout_2027_cartao_elegivel(v_rev);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pagamento_iniciar(p_proposta_id uuid, p_chave text, p_tipo text, p_ip text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.propostas_planos_2027; c jsonb; t public.checkout_2027_tentativas;
  v_teste boolean; v_modo text; v_max int; v_total int; v_valor int; v_simulado boolean; v_parc int; n int; v_rec boolean;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  IF r.etapa_checkout = 'paga' OR public.fn_checkout_2027_ja_aprovado(r.id) THEN RAISE EXCEPTION 'Pagamento em andamento'; END IF;
  IF r.etapa_checkout NOT IN ('contrato_aceito','aguardando_pagamento','falhou') OR r.aceite_id IS NULL THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  c := public.fn_checkout_2027_calcular(p_proposta_id);
  IF (c->>'total_centavos') IS DISTINCT FROM (r.revisao->>'total_centavos')
     OR (c->>'forma_plano') IS DISTINCT FROM (r.revisao->>'forma_plano')
     OR (c->>'parcelas_plano') IS DISTINCT FROM (r.revisao->>'parcelas_plano') THEN
    RAISE EXCEPTION 'O contrato mudou. Leia a versão atual e aceite de novo'; END IF;
  IF p_tipo NOT IN ('pix','cartao') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  v_rec := c->>'forma_plano' = 'recorrencia';
  IF p_tipo = 'pix' AND c->>'forma_plano' <> 'pix_vista' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF p_tipo = 'cartao' AND c->>'forma_plano' NOT IN ('cartao_parcelado','recorrencia') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF v_rec AND coalesce((c->>'servicos_centavos')::int,0) > 0 THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;

  IF p_tipo = 'pix' THEN
    SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='pix' AND status='pendente'
      AND expira_em > now() ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('reutilizada', true); END IF;
  ELSE
    SELECT count(*) INTO n FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao' AND created_at > now() - interval '30 minutes';
    IF n >= 3 THEN RAISE EXCEPTION 'Muitas tentativas. Tente novamente mais tarde'; END IF;
  END IF;

  v_total := (c->>'total_centavos')::int;
  IF v_rec THEN
    -- Cobra só a 1ª mensalidade agora; as demais ficam no cronograma.
    v_total := ((c->>'plano_centavos')::int) / greatest(1, (c->>'parcelas_plano')::int);
    v_parc := 1;
  ELSE
    v_parc := CASE WHEN p_tipo = 'cartao' THEN greatest(1, least(12, coalesce((c->>'parcelas_plano')::int, 1))) ELSE 1 END;
  END IF;
  v_teste := public.fn_checkout_2027_teste(p_proposta_id);
  SELECT valor #>> '{}' INTO v_modo FROM public.sistema_config WHERE chave = 'planos_pagamento_modo_teste';
  SELECT (valor #>> '{}')::int INTO v_max FROM public.sistema_config WHERE chave = 'planos_teste_valor_max_centavos';
  v_modo := coalesce(v_modo, 'simulacao'); v_max := least(coalesce(v_max, 100), 100);

  IF v_teste OR NOT public.fn_checkout_2027_ativo() THEN
    IF v_modo = 'real_baixo_valor' AND v_teste AND (NOT v_rec OR public.fn_checkout_2027_recorrencia_real(p_proposta_id)) THEN
      v_simulado := false; v_valor := least(v_total, v_max); v_parc := 1;
      UPDATE public.sistema_config SET valor = to_jsonb('simulacao'::text), updated_at = now() WHERE chave = 'planos_pagamento_modo_teste';
    ELSIF v_modo = 'real_baixo_valor' AND v_teste THEN
      RAISE EXCEPTION 'Pagamento por cartão indisponível no momento';
    ELSE
      v_simulado := true; v_valor := v_total;
    END IF;
  ELSE
    IF v_rec AND NOT public.fn_checkout_2027_recorrencia_real(p_proposta_id) THEN
      RAISE EXCEPTION 'Pagamento por cartão indisponível no momento'; END IF;
    v_simulado := false; v_valor := v_total;
  END IF;

  INSERT INTO public.checkout_2027_tentativas(proposta_id, aceite_id, tipo, simulado, valor_centavos, total_proposta_centavos, parcelas, expira_em, recorrencia)
  VALUES (r.id, r.aceite_id, p_tipo, v_simulado, v_valor, (c->>'total_centavos')::int, v_parc, CASE WHEN p_tipo='pix' THEN now() + interval '30 minutes' END, v_rec)
  RETURNING * INTO t;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='aguardando_pagamento', etapa_atualizada_em=now() WHERE id = r.id;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('reutilizada', false);
END $function$;

-- Cronograma da recorrência (idempotente). Power/Pro: 12 de uma vez; Start: ciclo atual + próximo.
-- Vencimento = data da venda + (n-1) meses a partir da mesma base (dias 29–31 caem no último dia do mês).
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_cronograma(p_tentativa_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t checkout_2027_tentativas; c jsonb; v_tok uuid; v_mensal int; v_n int; v_base date; v_valor int; i int; v_ins int := 0; v_k int;
BEGIN
  SELECT * INTO t FROM checkout_2027_tentativas WHERE id = p_tentativa_id AND tipo='cartao' AND recorrencia AND status='aprovado';
  IF NOT FOUND THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM planos_2027_mensalidades WHERE proposta_id = t.proposta_id) THEN RETURN 0; END IF;
  c := public.fn_checkout_2027_calcular(t.proposta_id);
  IF c->>'forma_plano' <> 'recorrencia' THEN RETURN 0; END IF;
  IF t.simulado THEN
    -- Simulação: cartão fictício, nunca 'active' (fora de fn_recorrencia_2027_devidas), nada vai à Rede.
    SELECT id INTO v_tok FROM rede_tokenizacoes WHERE tokenization_id = 'SIMULACAO-' || t.proposta_id;
    IF v_tok IS NULL THEN
      INSERT INTO rede_tokenizacoes(tokenization_id, proposta_id, aluno_id, origem, status)
      VALUES ('SIMULACAO-' || t.proposta_id, t.proposta_id, NULL, 'planos_simulacao', 'simulado') RETURNING id INTO v_tok;
    END IF;
  ELSE
    v_tok := t.tokenizacao_id;
  END IF;
  IF v_tok IS NULL THEN RAISE EXCEPTION 'recorrência sem cartão'; END IF;
  v_n := greatest(1, (c->>'parcelas_plano')::int);
  v_mensal := (c->>'plano_centavos')::int / v_n;
  -- Teste real: todas as mensalidades com o teto de teste (R$ 1,00).
  v_valor := CASE WHEN NOT t.simulado AND public.fn_checkout_2027_teste(t.proposta_id) THEN t.valor_centavos ELSE v_mensal END;
  v_base := (coalesce(t.updated_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  v_k := CASE WHEN c->>'familia' = 'start_2027' THEN 2 ELSE v_n END;
  FOR i IN 1..v_k LOOP
    INSERT INTO planos_2027_mensalidades(proposta_id, tokenizacao_id, numero, competencia, vencimento, valor_centavos,
      status, tentativas, tid, simulado, pago_em)
    VALUES (t.proposta_id, v_tok, i, date_trunc('month', v_base + make_interval(months => i-1))::date,
      (v_base + make_interval(months => i-1))::date, CASE WHEN i = 1 THEN t.valor_centavos ELSE v_valor END,
      CASE WHEN i = 1 THEN 'pago' ELSE 'pendente' END, CASE WHEN i = 1 THEN 1 ELSE 0 END,
      CASE WHEN i = 1 THEN left(t.ref, 40) END, t.simulado, CASE WHEN i = 1 THEN now() END)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN v_ins := v_ins + 1; END IF;
  END LOOP;
  RETURN v_ins;
END $$;

-- Start: gera o próximo ciclo depois de um pago (idempotente). Chamado pela rotina mensal (R4).
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_proximo_ciclo(p_proposta_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u planos_2027_mensalidades; b planos_2027_mensalidades; v_id uuid; v_venc date;
BEGIN
  IF (SELECT familia FROM propostas_planos_2027 WHERE id = p_proposta_id) IS DISTINCT FROM 'start_2027' THEN RETURN NULL; END IF;
  SELECT * INTO u FROM planos_2027_mensalidades WHERE proposta_id = p_proposta_id ORDER BY numero DESC LIMIT 1 FOR UPDATE;
  IF u.id IS NULL OR u.status <> 'pago' THEN RETURN NULL; END IF;
  SELECT * INTO b FROM planos_2027_mensalidades WHERE proposta_id = p_proposta_id AND numero = 1;
  v_venc := (b.vencimento + make_interval(months => u.numero))::date;
  INSERT INTO planos_2027_mensalidades(proposta_id, tokenizacao_id, numero, competencia, vencimento, valor_centavos, simulado)
  VALUES (p_proposta_id, u.tokenizacao_id, u.numero + 1, date_trunc('month', v_venc)::date, v_venc,
    CASE WHEN u.numero = 1 THEN coalesce((SELECT valor_centavos FROM planos_2027_mensalidades WHERE proposta_id=p_proposta_id AND numero=2), u.valor_centavos) ELSE u.valor_centavos END, u.simulado)
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_simular_resultado(p_tentativa_id uuid, p_resultado text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t public.checkout_2027_tentativas; j jsonb;
BEGIN
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id FOR UPDATE;
  IF NOT FOUND OR NOT t.simulado OR NOT public.fn_checkout_2027_teste(t.proposta_id) THEN RAISE EXCEPTION 'Checkout indisponível no momento'; END IF;
  IF p_resultado = 'expirado' THEN
    UPDATE public.checkout_2027_tentativas SET expira_em = now() - interval '1 second', updated_at=now() WHERE id = t.id AND status='pendente';
    RETURN public.fn_checkout_2027_tentativa_atualizar(t.id, 'expirado', NULL, 'simulado');
  END IF;
  j := public.fn_checkout_2027_tentativa_atualizar(t.id, p_resultado, 'SIMULACAO-' || left(t.id::text, 8), 'simulado');
  IF p_resultado = 'aprovado' AND t.recorrencia THEN PERFORM public.fn_recorrencia_2027_cronograma(t.id); END IF;
  RETURN j;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_liquidado(p_tentativa_id uuid, p_tid text, p_nsu text, p_autorizacao text, p_return_code text, p_valor_centavos integer, p_parcelas integer, p_raw jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t public.checkout_2027_tentativas; v_mask text;
BEGIN
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id = p_tentativa_id AND tipo='cartao' AND NOT simulado FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('resultado','nao_encontrado'); END IF;
  IF t.status = 'aprovado' THEN RETURN jsonb_build_object('resultado','ja_processado','proposta_id',t.proposta_id); END IF;
  IF p_valor_centavos IS DISTINCT FROM t.valor_centavos OR p_parcelas IS DISTINCT FROM t.parcelas THEN
    UPDATE public.checkout_2027_tentativas SET status='desconhecido', motivo='valor_divergente' WHERE id=t.id AND status IN ('processando','desconhecido');
    BEGIN PERFORM public.fn_checkout_2027_cartao_divergente_aviso(t.proposta_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN jsonb_build_object('resultado','valor_divergente'); END IF;
  v_mask := CASE WHEN length(coalesce(p_tid,'')) > 4 THEN repeat('*', length(p_tid)-4) || right(p_tid,4) ELSE p_tid END;
  INSERT INTO public.pagamentos_rede(proposta_id, amount, installments, kind, tid, nsu, authorization_code, return_code, status, raw_response, idempotency_key)
  VALUES (t.proposta_id, t.valor_centavos, t.parcelas, 'token', p_tid, p_nsu, p_autorizacao, p_return_code, 'approved', p_raw,
          'planos:' || t.proposta_id || ':' || coalesce(t.aceite_id::text,'') || ':' || t.id)
  ON CONFLICT DO NOTHING;
  UPDATE public.checkout_2027_tentativas SET status='aprovado', ref=p_tid, motivo=NULL, updated_at=now() WHERE id=t.id;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='paga', pago_em=now(), pagamento_tipo='cartao', pagamento_ref=p_tid,
    pagamento_parcelas=t.parcelas, pagamento_nsu=p_nsu, pagamento_tid_mascarado=v_mask, etapa_atualizada_em=now()
   WHERE id = t.proposta_id AND pago_em IS NULL;
  -- Recorrência: cronograma na mesma transação da baixa (falha aqui desfaz a baixa e fica 'desconhecido' para conciliação).
  IF t.recorrencia THEN PERFORM public.fn_recorrencia_2027_cronograma(t.id); END IF;
  BEGIN
    PERFORM public.fn_checkout_2027_pos_pagamento(t.proposta_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.propostas_planos_2027 SET lead_erro = coalesce(lead_erro || ' | ', '') || 'aviso pagamento: ' || left(SQLERRM, 200) WHERE id = t.proposta_id;
  END;
  RETURN jsonb_build_object('resultado','baixado','proposta_id',t.proposta_id);
END $function$;

-- Dados do e-mail: bloco da recorrência (sem dados sensíveis; só o final do cartão).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_dados(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.propostas_planos_2027; v_plano text; v_serv text; m1 public.planos_2027_mensalidades; v_n int; v_final text;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(nome_exibicao, nome) INTO v_plano FROM public.planos_catalogo WHERE codigo = r.plano_codigo ORDER BY versao DESC NULLS LAST LIMIT 1;
  SELECT string_agg(coalesce(s.nome, c), ', ') INTO v_serv
    FROM unnest(coalesce(r.servicos_codigos, '{}'::text[])) c
    LEFT JOIN LATERAL (SELECT nome FROM public.servicos_catalogo WHERE codigo = c ORDER BY versao DESC NULLS LAST LIMIT 1) s ON true;
  SELECT * INTO m1 FROM public.planos_2027_mensalidades WHERE proposta_id = r.id AND numero = 1;
  SELECT count(*) INTO v_n FROM public.planos_2027_mensalidades WHERE proposta_id = r.id;
  SELECT final_cartao INTO v_final FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao' AND status='aprovado' ORDER BY updated_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'id', r.id, 'nome', r.nome, 'email', r.email, 'whatsapp', r.whatsapp, 'cpf_ultimos3', r.cpf_ultimos3,
    'plano', coalesce(v_plano, r.familia, r.plano_codigo), 'frequencia', r.frequencia, 'servicos', v_serv,
    'pagamento_tipo', r.pagamento_tipo, 'parcelas', coalesce(r.parcelas_plano, 1),
    'total_centavos', r.valor_total_centavos, 'pago_em', r.pago_em, 'teste_admin', coalesce(r.teste_admin, false),
    'vinculo', CASE WHEN r.aluno_id IS NOT NULL THEN 'aluno' WHEN r.aluno_suspeito_id IS NOT NULL THEN 'suspeito' ELSE 'novo' END,
    'email_enviado_em', r.email_confirmacao_enviado_em,
    'recorrencia', CASE WHEN m1.id IS NULL THEN NULL ELSE jsonb_build_object(
      'familia', r.familia, 'mensal_centavos', m1.valor_centavos, 'dia', extract(day FROM m1.vencimento)::int,
      'mensalidades', CASE WHEN r.familia = 'start_2027' THEN NULL ELSE v_n END,
      'final_cartao', CASE WHEN v_final ~ '^[0-9]{4}$' THEN v_final END) END);
END $function$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_recorrencia_real(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_cronograma(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_proximo_ciclo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_recorrencia_real(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_cronograma(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_proximo_ciclo(uuid) TO service_role;