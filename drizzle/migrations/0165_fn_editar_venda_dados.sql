CREATE OR REPLACE FUNCTION public.fn_editar_venda_dados(
  p_venda_id uuid, p_data_venda date, p_catalogo_id uuid, p_valor numeric, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_nome text;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF coalesce(length(trim(p_motivo)),0) < 3 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  IF p_valor IS NULL OR p_valor < 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF p_data_venda IS NULL THEN RAISE EXCEPTION 'Data inválida'; END IF;
  SELECT * INTO v FROM vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF v.status_pagamento::text IN ('cancelado','estornado') THEN
    RAISE EXCEPTION 'Venda cancelada ou estornada não pode ser editada';
  END IF;
  v_nome := v.nome_snapshot;
  IF p_catalogo_id IS NOT NULL AND p_catalogo_id IS DISTINCT FROM v.catalogo_id THEN
    IF v.tipo::text = 'plano' THEN
      SELECT nome INTO v_nome FROM planos_catalogo WHERE id = p_catalogo_id;
    ELSE
      SELECT nome INTO v_nome FROM servicos_catalogo WHERE id = p_catalogo_id;
    END IF;
    IF v_nome IS NULL THEN RAISE EXCEPTION 'Item não encontrado no catálogo'; END IF;
  END IF;
  UPDATE vendas SET
    data_venda = p_data_venda,
    catalogo_id = coalesce(p_catalogo_id, catalogo_id),
    nome_snapshot = v_nome,
    valor = p_valor,
    valor_final = greatest(0, p_valor - coalesce(desconto,0))
  WHERE id = p_venda_id;
  INSERT INTO audit_log(tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('vendas', p_venda_id, 'update', auth.uid(),
    jsonb_build_object('data_venda', v.data_venda, 'catalogo_id', v.catalogo_id, 'nome', v.nome_snapshot, 'valor', v.valor, 'valor_final', v.valor_final),
    jsonb_build_object('data_venda', p_data_venda, 'catalogo_id', coalesce(p_catalogo_id, v.catalogo_id), 'nome', v_nome, 'valor', p_valor, 'motivo', trim(p_motivo), 'acao', 'editar_dados_venda'));
END $$;
REVOKE ALL ON FUNCTION public.fn_editar_venda_dados(uuid,date,uuid,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_editar_venda_dados(uuid,date,uuid,numeric,text) TO authenticated;