ALTER TABLE public.conciliacoes_bancarias ADD COLUMN IF NOT EXISTS motivo text NULL;

CREATE TABLE public.conciliacao_saida_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacao_id uuid NOT NULL REFERENCES public.conciliacoes_bancarias(id) ON DELETE CASCADE,
  despesa_id uuid NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  marcou_conciliado boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_saida_itens_despesa_ativa ON public.conciliacao_saida_itens(despesa_id) WHERE ativo;
CREATE INDEX idx_saida_itens_conc ON public.conciliacao_saida_itens(conciliacao_id);
GRANT SELECT ON public.conciliacao_saida_itens TO authenticated;
GRANT ALL ON public.conciliacao_saida_itens TO service_role;
ALTER TABLE public.conciliacao_saida_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le itens saida" ON public.conciliacao_saida_itens FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Liga uma saída à soma de várias despesas (ex.: fatura de cartão). Não altera valores.
CREATE OR REPLACE FUNCTION public.fn_conciliar_saida_multiplas(p_movimento_id uuid, p_despesa_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; v_soma numeric; v_n int; v_conc uuid;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_despesa_ids IS NULL OR cardinality(p_despesa_ids) < 2 THEN RAISE EXCEPTION 'selecione_varias'; END IF;
  SELECT * INTO m FROM public.inter_extrato_movimentos WHERE id = p_movimento_id FOR UPDATE;
  IF NOT FOUND OR m.tipo_operacao <> 'D' THEN RAISE EXCEPTION 'movimento_invalido'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito) THEN
    RAISE EXCEPTION 'movimento_ja_vinculado'; END IF;
  PERFORM 1 FROM public.despesas WHERE id = ANY(p_despesa_ids) FOR UPDATE;
  SELECT count(*), coalesce(sum(round(valor::numeric,2)),0) INTO v_n, v_soma FROM public.despesas WHERE id = ANY(p_despesa_ids);
  IF v_n <> cardinality(ARRAY(SELECT DISTINCT unnest(p_despesa_ids))) THEN RAISE EXCEPTION 'despesa_invalida'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE NOT desfeito AND tabela_origem='despesas' AND registro_id = ANY(p_despesa_ids))
     OR EXISTS (SELECT 1 FROM public.conciliacao_saida_itens WHERE ativo AND despesa_id = ANY(p_despesa_ids)) THEN
    RAISE EXCEPTION 'despesa_ja_ligada'; END IF;
  IF abs(v_soma - round(m.valor::numeric,2)) > 0.01 THEN RAISE EXCEPTION 'soma_diferente'; END IF;
  INSERT INTO public.conciliacoes_bancarias(movimento_id, tabela_origem, registro_id, tipo_match, confianca, criado_por)
  VALUES (p_movimento_id, 'despesas_multiplas', p_movimento_id, 'manual', 'exata', auth.uid()) RETURNING id INTO v_conc;
  INSERT INTO public.conciliacao_saida_itens(conciliacao_id, despesa_id, valor, marcou_conciliado)
  SELECT v_conc, d.id, d.valor, NOT d.conciliado FROM public.despesas d WHERE d.id = ANY(p_despesa_ids);
  UPDATE public.despesas SET conciliado = true, updated_by = auth.uid(), updated_at = now()
  WHERE id = ANY(p_despesa_ids) AND NOT conciliado;
  UPDATE public.conciliacao_avisos SET resolvido_em = now() WHERE movimento_id = p_movimento_id AND resolvido_em IS NULL;
  RETURN jsonb_build_object('ok', true, 'itens', v_n, 'soma', v_soma);
END $$;

-- Marca uma saída como "não é despesa" (ex.: devolução de Pix recebido por engano).
CREATE OR REPLACE FUNCTION public.fn_ignorar_saida(p_movimento_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF coalesce(btrim(p_motivo),'') = '' THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;
  SELECT * INTO m FROM public.inter_extrato_movimentos WHERE id = p_movimento_id FOR UPDATE;
  IF NOT FOUND OR m.tipo_operacao <> 'D' THEN RAISE EXCEPTION 'movimento_invalido'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito) THEN
    RAISE EXCEPTION 'movimento_ja_vinculado'; END IF;
  INSERT INTO public.conciliacoes_bancarias(movimento_id, tabela_origem, registro_id, tipo_match, confianca, criado_por, motivo)
  VALUES (p_movimento_id, 'ignorado', p_movimento_id, 'manual', 'exata', auth.uid(), left(btrim(p_motivo), 300));
  UPDATE public.conciliacao_avisos SET resolvido_em = now() WHERE movimento_id = p_movimento_id AND resolvido_em IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.fn_desfazer_conciliacao_saida(p_movimento_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO c FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito
    AND tabela_origem IN ('despesas','despesas_multiplas','ignorado') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'vinculo_inexistente'; END IF;
  UPDATE public.conciliacoes_bancarias SET desfeito = true WHERE id = c.id;
  IF c.tabela_origem = 'despesas' THEN
    UPDATE public.despesas SET conciliado = false,
      valor = coalesce(c.valor_anterior, valor), valor_pago = coalesce(c.valor_anterior, valor_pago),
      updated_by = auth.uid(), updated_at = now()
    WHERE id = c.registro_id;
  ELSIF c.tabela_origem = 'despesas_multiplas' THEN
    UPDATE public.despesas d SET conciliado = false, updated_by = auth.uid(), updated_at = now()
    FROM public.conciliacao_saida_itens i
    WHERE i.conciliacao_id = c.id AND i.ativo AND i.marcou_conciliado AND d.id = i.despesa_id;
    UPDATE public.conciliacao_saida_itens SET ativo = false WHERE conciliacao_id = c.id;
  END IF;
  UPDATE public.conciliacao_avisos SET resolvido_em = NULL WHERE movimento_id = p_movimento_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_conciliar_saida_multiplas(uuid,uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ignorar_saida(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_conciliar_saida_multiplas(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ignorar_saida(uuid,text) TO authenticated;