-- VOLTA (usar somente se necessário): restaura as assinaturas e corpos anteriores,
-- capturados do banco em 2026-10-14 antes da troca.
-- 1) fn_checkout_2027_pagamento_iniciar volta a 4 argumentos (sem p_parcelas),
--    com a comparação de parcelas_plano valendo para TODAS as formas.
DROP FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid, text, text, text, int);
CREATE FUNCTION public.fn_checkout_2027_pagamento_iniciar(p_proposta_id uuid, p_chave text, p_tipo text, p_ip text)
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
REVOKE ALL ON FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid, text, text, text) TO service_role;

-- 2) fn_checkout_2027_cartao_reservar volta a 3 argumentos, chamando o iniciar de 4.
DROP FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text, int);
CREATE FUNCTION public.fn_checkout_2027_cartao_reservar(p_proposta_id uuid, p_chave text, p_ip text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.propostas_planos_2027; t public.checkout_2027_tentativas; j jsonb;
BEGIN
  r := public.fn_checkout_2027_sessao(p_proposta_id, p_chave);
  PERFORM 1 FROM public.propostas_planos_2027 WHERE id = r.id FOR UPDATE;
  SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id = r.id AND tipo='cartao'
    AND status IN ('processando','desconhecido') ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', true); END IF;
  IF NOT public.fn_checkout_2027_cartao_real(r.id) THEN RAISE EXCEPTION 'Pagamento por cartão indisponível no momento'; END IF;
  j := public.fn_checkout_2027_pagamento_iniciar(p_proposta_id, p_chave, 'cartao', p_ip);
  IF (j->>'simulado')::boolean THEN RETURN j; END IF;
  UPDATE public.checkout_2027_tentativas SET status='processando', motivo='token_pendente', updated_at=now()
   WHERE id = (j->>'id')::uuid RETURNING * INTO t;
  RETURN public.fn_checkout_2027_tentativa_json(t) || jsonb_build_object('em_andamento', false);
END $function$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_reservar(uuid, text, text) TO service_role;

-- 3) fn_checkout_2027_email_dados: volta a usar parcelas_plano.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_dados(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
