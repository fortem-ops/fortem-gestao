CREATE OR REPLACE FUNCTION public.fn_mensalidade_manual_gerar(p_venda_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v vendas; k contratos; pl planos; c1 cobrancas; t rede_tokenizacoes; n int; v_venc date; v_valor int; v_cob uuid; r record; v_qtd int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_mensalidades:'||p_venda_id::text,0));
  SELECT * INTO v FROM vendas WHERE id = p_venda_id;
  IF v.id IS NULL OR v.origem IS DISTINCT FROM 'manual' OR v.tipo_cobranca IS DISTINCT FROM 'recorrencia' OR v.catalogo_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM planos_catalogo pc WHERE pc.id = v.catalogo_id AND pc.versao = 2027) THEN
    RETURN jsonb_build_object('gerado', false, 'motivo', 'nao_e_venda_manual_2027_recorrente');
  END IF;
  IF v.status_pagamento IN ('cancelado','estornado') THEN RETURN jsonb_build_object('gerado', false, 'motivo', 'venda_cancelada'); END IF;
  IF EXISTS (SELECT 1 FROM planos_2027_mensalidades WHERE venda_origem_id = v.id) THEN
    RETURN jsonb_build_object('gerado', false, 'motivo', 'ja_gerado', 'idempotente', true);
  END IF;
  SELECT count(*) INTO n FROM contratos WHERE plano_id = v.plano_id AND aluno_id = v.aluno_id AND forma_pagamento = 'cartao_recorrencia';
  IF n <> 1 THEN RAISE EXCEPTION 'Contrato da venda ausente ou ambíguo'; END IF;
  SELECT * INTO k FROM contratos WHERE plano_id = v.plano_id AND aluno_id = v.aluno_id AND forma_pagamento = 'cartao_recorrencia';
  IF k.status <> 'ativo' OR k.data_cancelamento IS NOT NULL OR k.catalogo_id IS NULL THEN
    RETURN jsonb_build_object('gerado', false, 'motivo', 'contrato_inativo_ou_cancelamento');
  END IF;
  SELECT * INTO c1 FROM cobrancas WHERE contrato_id = k.id AND numero_ciclo = 1;
  IF c1.id IS NULL OR c1.status <> 'pago' THEN RETURN jsonb_build_object('gerado', false, 'motivo', 'ciclo1_nao_pago'); END IF;
  SELECT tk.* INTO t FROM rede_tokenizacoes tk JOIN cartoes_salvos cs ON cs.id = tk.cartao_salvo_id
   WHERE tk.cartao_salvo_id = k.cartao_token_id AND tk.aluno_id = k.aluno_id AND tk.proposta_id IS NULL AND tk.status = 'active'
   ORDER BY tk.created_at DESC LIMIT 1;
  IF t.id IS NULL THEN
    INSERT INTO system_logs(modulo, acao, mensagem, payload) VALUES ('planos-recorrencia', 'manual_sem_cartao',
      'Venda manual recorrente sem cartão ativo vinculado ao contrato; mensalidades não geradas', jsonb_build_object('venda_id', v.id, 'contrato_id', k.id));
    RETURN jsonb_build_object('gerado', false, 'motivo', 'sem_cartao_ativo');
  END IF;
  IF k.plano_tipo = 'start_2027' THEN
    SELECT * INTO pl FROM planos WHERE id = k.plano_id;
    IF NOT coalesce(pl.renovacao_automatica, false) THEN RETURN jsonb_build_object('gerado', false, 'motivo', 'sem_renovacao_automatica'); END IF;
    v_venc := (k.data_inicio + interval '1 month')::date;
    v_valor := round((pl.valor - LEAST(GREATEST(coalesce(pl.desconto_recorrente, 0), 0), pl.valor)) * 100)::int;
    IF EXISTS (SELECT 1 FROM cobrancas WHERE contrato_id = k.id AND numero_ciclo = 2) THEN RAISE EXCEPTION 'Cobrança nº 2 já existe no contrato'; END IF;
    INSERT INTO cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento, meio_registro, descricao, composicao)
    VALUES (k.id, k.aluno_id, 2, v_valor / 100.0, v_venc, 'pendente', 'cartao_recorrencia', 'automatico',
      'Mensalidade 2 — recorrência automática no cartão',
      jsonb_build_object('plano', v_valor / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb))
    RETURNING id INTO v_cob;
    INSERT INTO planos_2027_mensalidades (venda_origem_id, tokenizacao_id, contrato_id, cobranca_id, numero, competencia, vencimento, valor_centavos, simulado)
    VALUES (v.id, t.id, k.id, v_cob, 2, date_trunc('month', v_venc)::date, v_venc, v_valor, false);
    v_qtd := 1;
  ELSE
    FOR r IN SELECT * FROM cobrancas WHERE contrato_id = k.id AND numero_ciclo BETWEEN 2 AND 12 AND status IN ('pendente','atrasado') ORDER BY numero_ciclo LOOP
      INSERT INTO planos_2027_mensalidades (venda_origem_id, tokenizacao_id, contrato_id, cobranca_id, numero, competencia, vencimento, valor_centavos, simulado)
      VALUES (v.id, t.id, k.id, r.id, r.numero_ciclo, date_trunc('month', r.data_vencimento)::date, r.data_vencimento, round(r.valor * 100)::int, false);
      v_qtd := v_qtd + 1;
    END LOOP;
  END IF;
  INSERT INTO system_logs(modulo, acao, mensagem, payload) VALUES ('planos-recorrencia', 'manual_mensalidades_geradas',
    'Venda manual 2027 entrou na recorrência automática', jsonb_build_object('venda_id', v.id, 'contrato_id', k.id, 'quantidade', v_qtd, 'tokenizacao_id', t.id));
  RETURN jsonb_build_object('gerado', true, 'quantidade', v_qtd, 'contrato_id', k.id);
END $function$;
