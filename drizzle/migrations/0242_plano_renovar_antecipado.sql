CREATE OR REPLACE FUNCTION public.fn_plano_renovar_antecipado(_plano_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.planos%ROWTYPE;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_cat uuid; v_forma text; v_venda uuid; v_novo uuid; v_desc numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid() AND pr.ativo IS TRUE)) THEN
    RAISE EXCEPTION 'Apenas administradores podem renovar antecipadamente';
  END IF;
  SELECT * INTO p FROM public.planos WHERE id = _plano_id FOR UPDATE;
  IF NOT FOUND OR p.ativo IS NOT TRUE THEN RAISE EXCEPTION 'Plano não encontrado ou inativo'; END IF;
  IF p.catalogo_id IS NOT NULL THEN RAISE EXCEPTION 'Planos 2027 seguem o próprio cronograma'; END IF;
  IF p.renovacao_automatica IS NOT TRUE OR COALESCE(p.duracao_meses,1) <> 1 THEN RAISE EXCEPTION 'Só planos mensais com renovação automática'; END IF;
  IF p.data_inicio >= v_hoje THEN RAISE EXCEPTION 'O ciclo atual começou hoje ou ainda não começou'; END IF;
  IF EXISTS (SELECT 1 FROM public.vendas WHERE aluno_id = p.aluno_id AND origem = 'renovacao_antecipada' AND data_venda = v_hoje) THEN
    RAISE EXCEPTION 'Já houve renovação antecipada hoje para este aluno';
  END IF;

  SELECT catalogo_id, forma_pagamento INTO v_cat, v_forma FROM public.vendas
   WHERE aluno_id = p.aluno_id AND tipo = 'plano' AND catalogo_id IS NOT NULL AND plano_id = p.id
   ORDER BY created_at DESC LIMIT 1;
  IF v_cat IS NULL THEN
    SELECT catalogo_id, forma_pagamento INTO v_cat, v_forma FROM public.vendas
     WHERE aluno_id = p.aluno_id AND tipo = 'plano' AND catalogo_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_cat IS NULL THEN RAISE EXCEPTION 'Pacote do catálogo não identificado'; END IF;

  v_desc := COALESCE(p.desconto_recorrente,0);
  UPDATE public.planos SET ativo = false, data_fim = v_hoje, proxima_renovacao = v_hoje WHERE id = p.id;

  INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
    forma_pagamento, parcelas, status_pagamento, data_venda, origem)
  VALUES (p.aluno_id, 'plano', v_cat, p.tipo || ' (renovação antecipada)', p.valor, v_desc,
    GREATEST(0, COALESCE(p.valor,0) - v_desc), COALESCE(p.forma_pagamento_padrao, v_forma),
    COALESCE(p.parcelas_padrao,1), 'pendente', v_hoje, 'renovacao_antecipada')
  RETURNING id, plano_id INTO v_venda, v_novo;

  IF v_novo IS NOT NULL THEN
    UPDATE public.planos SET renovacao_automatica = true,
      proxima_renovacao = (v_hoje + interval '1 month')::date,
      desconto_recorrente = v_desc
     WHERE id = v_novo AND (proxima_renovacao IS NULL OR proxima_renovacao <> (v_hoje + interval '1 month')::date OR desconto_recorrente IS DISTINCT FROM v_desc);
  END IF;

  INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, dados_novos)
  SELECT auth.uid(), 'renovacao_antecipada', 'planos', p.id,
    jsonb_build_object('plano_anterior', p.id, 'plano_novo', v_novo, 'venda', v_venda, 'inicio', v_hoje, 'vencimento_anterior', p.proxima_renovacao)
  WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_log' AND column_name='acao');

  RETURN jsonb_build_object('venda_id', v_venda, 'plano_novo', v_novo, 'inicio', v_hoje);
END $$;
REVOKE ALL ON FUNCTION public.fn_plano_renovar_antecipado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_plano_renovar_antecipado(uuid) TO authenticated;