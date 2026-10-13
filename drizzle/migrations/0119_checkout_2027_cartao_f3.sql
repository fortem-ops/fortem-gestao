ALTER TABLE public.propostas_planos_2027 ADD COLUMN IF NOT EXISTS notificacao_cartao_divergente_id uuid;

-- Nome do titular: só nas linhas de proposta (aluno_id nulo). Apaga ao ficar inativo/recusado/expirado.
CREATE OR REPLACE FUNCTION public.fn_planos_token_limpar_nome()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.proposta_id IS NOT NULL AND NEW.aluno_id IS NULL AND NEW.status IS DISTINCT FROM 'pending' AND NEW.status IS DISTINCT FROM 'active' THEN
    NEW.cardholder_name := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_planos_token_limpar_nome ON public.rede_tokenizacoes;
CREATE TRIGGER trg_planos_token_limpar_nome BEFORE INSERT OR UPDATE ON public.rede_tokenizacoes
  FOR EACH ROW WHEN (NEW.proposta_id IS NOT NULL AND NEW.aluno_id IS NULL) EXECUTE FUNCTION public.fn_planos_token_limpar_nome();

-- Tentativa encerrada (aprovada, recusada, expirada): apaga o nome do token dela (só linha de proposta).
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_tentativa_limpar_nome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.rede_tokenizacoes SET cardholder_name = NULL
   WHERE id = NEW.tokenizacao_id AND proposta_id IS NOT NULL AND aluno_id IS NULL AND cardholder_name IS NOT NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_checkout_2027_tentativa_limpar_nome ON public.checkout_2027_tentativas;
CREATE TRIGGER trg_checkout_2027_tentativa_limpar_nome AFTER UPDATE OF status ON public.checkout_2027_tentativas
  FOR EACH ROW WHEN (NEW.tipo = 'cartao' AND NEW.tokenizacao_id IS NOT NULL AND NEW.status IN ('aprovado','recusado','expirado'))
  EXECUTE FUNCTION public.fn_checkout_2027_tentativa_limpar_nome();
REVOKE ALL ON FUNCTION public.fn_planos_token_limpar_nome() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_tentativa_limpar_nome() FROM PUBLIC, anon, authenticated;

-- Conferência com valor/parcelas diferentes: aviso único por proposta, sem dados de cartão.
CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_divergente_aviso(p_proposta_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.propostas_planos_2027; d jsonb; v_criador uuid; v_notif uuid;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND OR r.notificacao_cartao_divergente_id IS NOT NULL THEN RETURN; END IF;
  d := public.fn_checkout_2027_email_dados(p_proposta_id);
  SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_criador IS NULL THEN RETURN; END IF;
  INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (
    CASE WHEN r.teste_admin THEN '[TESTE] ' ELSE '' END || 'Cartão a conferir no site: ' || coalesce(d->>'nome', 'sem nome'),
    'A Rede informou uma transação desta proposta com valor ou parcelas diferentes do combinado. '
      || 'O pagamento ficou em conferência e não será cobrado de novo.' || E'\n'
      || 'Total da proposta R$ ' || translate(to_char(coalesce((d->>'total_centavos')::numeric, 0) / 100, 'FM999,999,990.00'), ',.', '.,') || E'\n\n'
      || CASE WHEN r.teste_admin THEN 'Teste de admin: não ativar nada.' ELSE 'Ação: conferir a transação no portal da Rede antes de ativar.' END,
    'financeiro', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
  UPDATE public.propostas_planos_2027 SET notificacao_cartao_divergente_id = v_notif WHERE id = p_proposta_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_divergente_aviso(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_divergente_aviso(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_cartao_liquidado(p_tentativa_id uuid, p_tid text, p_nsu text, p_autorizacao text,
  p_return_code text, p_valor_centavos integer, p_parcelas integer, p_raw jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  BEGIN
    PERFORM public.fn_checkout_2027_pos_pagamento(t.proposta_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.propostas_planos_2027 SET lead_erro = coalesce(lead_erro || ' | ', '') || 'aviso pagamento: ' || left(SQLERRM, 200) WHERE id = t.proposta_id;
  END;
  RETURN jsonb_build_object('resultado','baixado','proposta_id',t.proposta_id);
END $$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_cartao_liquidado(uuid, text, text, text, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_cartao_liquidado(uuid, text, text, text, text, integer, integer, jsonb) TO service_role;