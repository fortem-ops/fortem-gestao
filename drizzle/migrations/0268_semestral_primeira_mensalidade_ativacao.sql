-- Etapa 4B do Plano Semestral: 1ª mensalidade cobrada no cartão na venda.
-- A venda nasce "aguardando pagamento": plano Semestral inativo, crédito da 1ª Avaliação inativo e
-- plano da agregadora intacto. Só a cobrança nº 1 paga ativa tudo e encerra a agregadora.

CREATE OR REPLACE FUNCTION public.fn_venda_semestral_criar(p jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  c public.planos_catalogo; e jsonb; r jsonb; v_teste boolean; pend record;
BEGIN
  IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, 'coordenador'::app_role) OR public.has_role(v_uid, 'professor'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para vender o Plano Semestral';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid AND familia = 'semestral_2027';
  IF NOT FOUND OR c.agregadora_requerida IS NULL THEN RAISE EXCEPTION 'Item do Plano Semestral não encontrado'; END IF;

  -- Venda já registrada e ainda sem a 1ª mensalidade paga: retoma a mesma (nova tentativa ou outro cartão).
  SELECT v.id AS venda_id, v.catalogo_id, k.id AS contrato_id, v.plano_id, cb.id AS cobranca_id, cb.valor
    INTO pend
    FROM public.vendas v
    JOIN public.planos pl ON pl.id = v.plano_id AND NOT pl.ativo
    JOIN public.contratos k ON k.plano_id = v.plano_id AND k.plano_tipo = 'semestral_2027' AND k.status = 'ativo'
    JOIN public.cobrancas cb ON cb.contrato_id = k.id AND cb.numero_ciclo = 1 AND cb.status IN ('pendente','atrasado')
   WHERE v.aluno_id = v_aluno AND v.status_pagamento NOT IN ('pago','cancelado','estornado')
     AND v.catalogo_id IN (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027')
   ORDER BY v.created_at DESC LIMIT 1;
  IF pend.venda_id IS NOT NULL THEN
    IF pend.catalogo_id <> c.id THEN
      RAISE EXCEPTION 'Já existe uma venda do Plano Semestral aguardando o pagamento da 1ª mensalidade (outro item). Conclua o pagamento dela.';
    END IF;
    RETURN jsonb_build_object('venda_id', pend.venda_id, 'contrato_id', pend.contrato_id, 'plano_id', pend.plano_id,
      'cobranca_id', pend.cobranca_id, 'valor_centavos', round(pend.valor * 100)::int, 'retomada', true, 'repetida', true,
      'agregadora', c.agregadora_requerida, 'contrato_modelo', 'semestral_' || c.agregadora_requerida);
  END IF;

  e := public.fn_semestral_elegivel(v_aluno, c.codigo, v_hoje);
  IF NOT (e->>'elegivel')::boolean THEN RAISE EXCEPTION 'Plano Semestral não permitido: %', e->>'motivo'; END IF;
  v_teste := EXISTS (SELECT 1 FROM public.sistema_config sc WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
                     AND jsonb_typeof(sc.valor) = 'array' AND sc.valor ? v_aluno::text);
  r := public.fn_venda_2027_gravar(jsonb_build_object(
      'aluno_id', v_aluno, 'catalogo_id', c.id, 'forma', 'recorrencia', 'parcelas', 1,
      'servicos', '[]'::jsonb, 'data_inicio', v_hoje, 'primeiro_vencimento', v_hoje,
      'substituir', false, 'observacoes', p->>'observacoes', 'idempotency_key', p->>'idempotency_key'),
    v_uid, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END, 'manual', false);
  IF COALESCE((r->>'repetida')::boolean, false) THEN RETURN r; END IF;

  -- Aguardando pagamento: nada vale antes da 1ª mensalidade aprovada.
  UPDATE public.planos SET ativo = false WHERE id = (r->>'plano_id')::uuid;
  UPDATE public.creditos_aluno SET ativo = false
   WHERE aluno_id = v_aluno AND origem_id IN ((r->>'venda_id')::uuid, (r->>'plano_id')::uuid) AND ativo;

  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'venda_semestral', 'Venda do Plano Semestral registrada; aguardando 1ª mensalidade no cartão',
    jsonb_build_object('venda_id', r->>'venda_id', 'contrato_id', r->>'contrato_id', 'codigo', c.codigo, 'agregadora', c.agregadora_requerida));
  RETURN r || jsonb_build_object('agregadora', c.agregadora_requerida,
    'contrato_modelo', 'semestral_' || c.agregadora_requerida,
    'valor_centavos', (SELECT round(cb.valor * 100)::int FROM public.cobrancas cb
                        WHERE cb.contrato_id = (r->>'contrato_id')::uuid AND cb.numero_ciclo = 1));
END $function$;

-- Cartão (tokenizado na Rede) usado na 1ª mensalidade e nos ciclos seguintes.
CREATE OR REPLACE FUNCTION public.fn_semestral_definir_cartao(p_venda uuid, p_cartao uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.vendas; k public.contratos;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:'||p_venda::text,0));
  SELECT * INTO v FROM public.vendas WHERE id = p_venda FOR UPDATE;
  SELECT * INTO k FROM public.contratos WHERE plano_id = v.plano_id AND plano_tipo = 'semestral_2027' FOR UPDATE;
  IF v.id IS NULL OR k.id IS NULL THEN RAISE EXCEPTION 'Venda do Plano Semestral não encontrada'; END IF;
  IF v.status_pagamento IN ('pago','cancelado','estornado') OR k.status <> 'ativo'
     OR EXISTS (SELECT 1 FROM public.cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1 AND status = 'pago') THEN
    RAISE EXCEPTION 'A 1ª mensalidade já foi paga ou a venda não está mais aberta';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_rede WHERE venda_id = v.id AND status IN ('pending','approved')) THEN
    RAISE EXCEPTION 'Há um pagamento em processamento para esta venda; não troque o cartão agora';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cartoes_salvos cs JOIN public.rede_tokenizacoes t ON t.cartao_salvo_id = cs.id
                  WHERE cs.id = p_cartao AND cs.aluno_id = v.aluno_id AND cs.ativo
                    AND t.aluno_id = v.aluno_id AND t.proposta_id IS NULL AND t.status = 'active') THEN
    RAISE EXCEPTION 'Cartão não pertence ao aluno ou ainda não foi confirmado pela Rede';
  END IF;
  UPDATE public.contratos SET cartao_token_id = p_cartao WHERE id = k.id;
  UPDATE public.planos SET cartao_token_id = p_cartao WHERE id = v.plano_id;
  RETURN jsonb_build_object('ok', true, 'contrato_id', k.id);
END $function$;
REVOKE ALL ON FUNCTION public.fn_semestral_definir_cartao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_semestral_definir_cartao(uuid, uuid) TO authenticated, service_role;

-- Ativação na 1ª mensalidade paga: plano e 1ª Avaliação passam a valer e SÓ ENTÃO a agregadora é encerrada.
CREATE OR REPLACE FUNCTION public.fn_semestral_ativar_venda(p_contrato uuid, p_venda uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k public.contratos; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_enc uuid[]; v_ja boolean;
BEGIN
  SELECT * INTO k FROM public.contratos WHERE id = p_contrato;
  SELECT ativo INTO v_ja FROM public.planos WHERE id = k.plano_id;
  IF v_ja THEN RETURN; END IF;
  UPDATE public.planos SET ativo = true WHERE id = k.plano_id;
  UPDATE public.creditos_aluno SET ativo = true
   WHERE aluno_id = k.aluno_id AND origem_id IN (p_venda, k.plano_id) AND NOT ativo
     AND atividade ILIKE 'Avalia%' AND COALESCE(quantidade_usada, 0) = 0;
  WITH enc AS (
    UPDATE public.planos SET ativo = false, data_fim = v_hoje
     WHERE aluno_id = k.aluno_id AND ativo AND tipo IN ('Gympass/Wellhub', 'Total Pass') AND id <> k.plano_id
    RETURNING id)
  SELECT array_agg(id) INTO v_enc FROM enc;
  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', 'venda_ativada', 'Plano Semestral ativado pela 1ª mensalidade paga; plano de agregadora encerrado',
    jsonb_build_object('venda_id', p_venda, 'contrato_id', k.id, 'planos_agregadora_encerrados', to_jsonb(v_enc)));
END $function$;
REVOKE ALL ON FUNCTION public.fn_semestral_ativar_venda(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_ativar_venda(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_semestral_liberar_ciclo()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  IF n = 1 THEN PERFORM public.fn_semestral_ativar_venda(k.id, v_venda); END IF;
  UPDATE public.creditos_aluno SET ativo = false
   WHERE origem_id = v_venda AND aluno_id = k.aluno_id AND ativo
     AND atividade IN ('Treino', 'Recovery (Bota de Compressão)') AND competencia < v_ini;
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
END $function$;