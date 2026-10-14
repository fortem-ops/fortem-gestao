CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_teste_real_reservar(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Proposta de teste = criada por admin na prévia (não depende do aluno identificado).
  IF p.id IS NULL OR NOT coalesce(p.teste_admin,false) OR NOT coalesce(p.previa,false) OR p.criado_por IS NULL
     OR NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.criado_por AND ur.role = 'admin')
     OR NOT public.is_admin(p.criado_por) THEN
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
END $function$;