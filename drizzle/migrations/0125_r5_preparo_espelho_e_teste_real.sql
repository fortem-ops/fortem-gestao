ALTER TABLE public.pagamentos_rede ADD COLUMN IF NOT EXISTS mensalidade_2027_id uuid;
COMMENT ON COLUMN public.pagamentos_rede.mensalidade_2027_id IS 'Mensalidade 2027 (planos_2027_mensalidades) cobrada nesta transação; nulo fora da recorrência 2027.';
-- Compra única do site: 1 aprovado por proposta (como antes). Recorrência: 1 aprovado por mensalidade.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pagamentos_rede_proposta_aprovado_v2 ON public.pagamentos_rede (proposta_id)
  WHERE proposta_id IS NOT NULL AND status = 'approved' AND mensalidade_2027_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pagamentos_rede_mensalidade_aprovada ON public.pagamentos_rede (mensalidade_2027_id)
  WHERE mensalidade_2027_id IS NOT NULL AND status = 'approved';
-- Liga a 1ª mensalidade (R3) ao pagamento já registrado antes de trocar o índice.
UPDATE public.pagamentos_rede pr SET mensalidade_2027_id = m.id
  FROM public.planos_2027_mensalidades m
 WHERE m.proposta_id = pr.proposta_id AND m.numero = 1 AND NOT m.simulado
   AND pr.proposta_id IS NOT NULL AND pr.status = 'approved' AND pr.mensalidade_2027_id IS NULL;
DROP INDEX IF EXISTS public.uniq_pagamentos_rede_proposta_aprovado;

-- Cronograma: liga a 1ª mensalidade ao pagamento da baixa (mesma transação).
CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_ligar_pagamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF NEW.numero = 1 AND NOT NEW.simulado THEN
    UPDATE pagamentos_rede SET mensalidade_2027_id = NEW.id
     WHERE proposta_id = NEW.proposta_id AND status = 'approved' AND mensalidade_2027_id IS NULL;
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_mensalidade_2027_ligar_pagamento ON public.planos_2027_mensalidades;
CREATE TRIGGER trg_mensalidade_2027_ligar_pagamento AFTER INSERT ON public.planos_2027_mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_mensalidade_2027_ligar_pagamento();

-- Resultado + espelho em pagamentos_rede (só cobranças reais; sem dados de cartão).
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_resultado_rede(p_id uuid, p_resultado text, p_tid text, p_nsu text,
  p_autorizacao text, p_return_code text, p_return_message text, p_motivo text, p_hoje date)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
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
END $f$;

-- Teste real R5: reserva UMA mensalidade da proposta de teste do NICOLAS TESTE e volta o modo para simulação.
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_teste_real_reservar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE v_modo text; p propostas_planos_2027; m planos_2027_mensalidades;
BEGIN
  -- Trava: uma execução por vez (linha da chave de modo).
  SELECT valor #>> '{}' INTO v_modo FROM sistema_config WHERE chave = 'planos_pagamento_modo_teste' FOR UPDATE;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_recorrencia_ativa'),'false') <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'recorrencia_desligada'); END IF;
  IF coalesce(v_modo,'simulacao') <> 'real_baixo_valor' THEN RETURN jsonb_build_object('ok', false, 'motivo', 'modo_simulacao'); END IF;
  IF coalesce((SELECT valor #>> '{}' FROM sistema_config WHERE chave='planos_cartao_real_ativo'),'false') <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'cartao_real_desligado'); END IF;
  SELECT * INTO p FROM propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF p.id IS NULL OR NOT coalesce(p.teste_admin,false) OR p.aluno_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM sistema_config sc WHERE sc.chave='vendas_2027_teste_aluno_ids' AND jsonb_typeof(sc.valor)='array' AND sc.valor ? p.aluno_id::text)
     OR NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = p.aluno_id AND a.nome = 'NICOLAS TESTE') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'proposta_nao_teste'); END IF;
  IF p.assinatura_cancelada_em IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'motivo', 'cancelada'); END IF;
  IF EXISTS (SELECT 1 FROM planos_2027_mensalidades WHERE proposta_id = p.id AND status IN ('processando','desconhecido')) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'cobranca_em_aberto'); END IF;
  SELECT x.* INTO m FROM planos_2027_mensalidades x
    JOIN rede_tokenizacoes t ON t.id = x.tokenizacao_id AND t.proposta_id = x.proposta_id AND t.aluno_id IS NULL
         AND t.status = 'active' AND t.origem = 'planos_site'
   WHERE x.proposta_id = p.id AND x.numero > 1 AND NOT x.simulado AND x.status IN ('pendente','recusado') AND x.tentativas < 3
   ORDER BY x.numero LIMIT 1 FOR UPDATE OF x;
  IF m.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'motivo', 'sem_mensalidade'); END IF;
  IF m.valor_centavos > 100 THEN RETURN jsonb_build_object('ok', false, 'motivo', 'teto_teste'); END IF;
  UPDATE planos_2027_mensalidades
     SET status = 'processando', tentativas = tentativas + 1,
         referencia = 'P27' || substr(replace(id::text,'-',''),1,12) || 'T' || (tentativas + 1)
   WHERE id = m.id RETURNING * INTO m;
  -- Uso único, como no cartão: volta para simulação.
  UPDATE sistema_config SET valor = to_jsonb('simulacao'::text), updated_at = now() WHERE chave = 'planos_pagamento_modo_teste';
  RETURN jsonb_build_object('ok', true, 'mensalidade', to_jsonb(m));
END $f$;

REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_resultado_rede(uuid,text,text,text,text,text,text,text,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_teste_real_reservar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_mensalidade_2027_ligar_pagamento() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_resultado_rede(uuid,text,text,text,text,text,text,text,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_teste_real_reservar(uuid) TO service_role;