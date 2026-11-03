ALTER TABLE public.conciliacoes_bancarias ADD COLUMN IF NOT EXISTS valor_anterior numeric NULL;

CREATE TABLE public.conciliacao_avisos (
  movimento_id uuid PRIMARY KEY REFERENCES public.inter_extrato_movimentos(id) ON DELETE CASCADE,
  notificacao_id uuid NULL,
  resolvido_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conciliacao_avisos TO authenticated;
GRANT ALL ON public.conciliacao_avisos TO service_role;
ALTER TABLE public.conciliacao_avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le avisos conciliacao" ON public.conciliacao_avisos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_conciliacao_pode_editar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','coordenador'))
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND ativo = false);
$$;

-- Vincula saída do Inter a despesa existente, ajustando o valor ao do banco.
CREATE OR REPLACE FUNCTION public.fn_conciliar_saida_despesa(p_movimento_id uuid, p_despesa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; d record; v_banco numeric;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO m FROM public.inter_extrato_movimentos WHERE id = p_movimento_id FOR UPDATE;
  IF NOT FOUND OR m.tipo_operacao <> 'D' THEN RAISE EXCEPTION 'movimento_invalido'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito) THEN
    RAISE EXCEPTION 'movimento_ja_vinculado'; END IF;
  SELECT * INTO d FROM public.despesas WHERE id = p_despesa_id FOR UPDATE;
  IF NOT FOUND OR d.conciliado THEN RAISE EXCEPTION 'despesa_invalida'; END IF;
  v_banco := round(m.valor::numeric, 2);
  INSERT INTO public.conciliacoes_bancarias(movimento_id, tabela_origem, registro_id, tipo_match, confianca, criado_por, valor_anterior)
  VALUES (p_movimento_id, 'despesas', p_despesa_id, 'manual',
          CASE WHEN abs(d.valor - v_banco) < 0.005 THEN 'exata' ELSE 'aproximada' END, auth.uid(),
          CASE WHEN abs(d.valor - v_banco) < 0.005 THEN NULL ELSE d.valor END);
  UPDATE public.despesas SET valor = v_banco, valor_pago = v_banco, status = 'pago',
    data_pagamento = m.data_entrada, conciliado = true, updated_by = auth.uid(), updated_at = now()
  WHERE id = p_despesa_id;
  UPDATE public.conciliacao_avisos SET resolvido_em = now() WHERE movimento_id = p_movimento_id AND resolvido_em IS NULL;
  RETURN jsonb_build_object('ok', true, 'valor_anterior', d.valor, 'valor_novo', v_banco);
END $$;

-- Cria despesa nova a partir da saída e já concilia.
CREATE OR REPLACE FUNCTION public.fn_conciliar_saida_nova_despesa(
  p_movimento_id uuid, p_descricao text, p_categoria_id uuid, p_tipo text,
  p_fornecedor_id uuid DEFAULT NULL, p_forma_pagamento text DEFAULT NULL, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; v_id uuid;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF coalesce(btrim(p_descricao),'') = '' THEN RAISE EXCEPTION 'descricao_obrigatoria'; END IF;
  IF p_tipo NOT IN ('fixa','variavel') THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.despesas_categorias WHERE id = p_categoria_id AND nivel IS NOT NULL AND ativo) THEN
    RAISE EXCEPTION 'categoria_invalida'; END IF;
  SELECT * INTO m FROM public.inter_extrato_movimentos WHERE id = p_movimento_id FOR UPDATE;
  IF NOT FOUND OR m.tipo_operacao <> 'D' THEN RAISE EXCEPTION 'movimento_invalido'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito) THEN
    RAISE EXCEPTION 'movimento_ja_vinculado'; END IF;
  INSERT INTO public.despesas(descricao, categoria_id, tipo, valor, valor_pago, data_competencia, data_pagamento,
    status, origem, conta_bancaria, forma_pagamento, fornecedor_id, observacao, conciliado, created_by, updated_by)
  VALUES (btrim(p_descricao), p_categoria_id, p_tipo, round(m.valor::numeric,2), round(m.valor::numeric,2),
    m.data_entrada, m.data_entrada, 'pago', 'manual', 'BANCO INTER', p_forma_pagamento, p_fornecedor_id,
    p_observacao, true, auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.conciliacoes_bancarias(movimento_id, tabela_origem, registro_id, tipo_match, confianca, criado_por)
  VALUES (p_movimento_id, 'despesas', v_id, 'manual', 'exata', auth.uid());
  UPDATE public.conciliacao_avisos SET resolvido_em = now() WHERE movimento_id = p_movimento_id AND resolvido_em IS NULL;
  RETURN v_id;
END $$;

-- Desfaz o vínculo; volta o valor anterior quando houve ajuste.
CREATE OR REPLACE FUNCTION public.fn_desfazer_conciliacao_saida(p_movimento_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO c FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito AND tabela_origem='despesas' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'vinculo_inexistente'; END IF;
  UPDATE public.conciliacoes_bancarias SET desfeito = true WHERE id = c.id;
  UPDATE public.despesas SET conciliado = false,
    valor = coalesce(c.valor_anterior, valor), valor_pago = coalesce(c.valor_anterior, valor_pago),
    updated_by = auth.uid(), updated_at = now()
  WHERE id = c.registro_id;
  UPDATE public.conciliacao_avisos SET resolvido_em = NULL WHERE movimento_id = p_movimento_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_conciliar_saida_despesa(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_conciliar_saida_nova_despesa(uuid,text,uuid,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_desfazer_conciliacao_saida(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_conciliacao_pode_editar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_conciliar_saida_despesa(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_conciliar_saida_nova_despesa(uuid,text,uuid,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_desfazer_conciliacao_saida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_conciliacao_pode_editar() TO authenticated;