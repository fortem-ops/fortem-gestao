ALTER TABLE public.conciliacao_saida_itens ALTER COLUMN despesa_id DROP NOT NULL;
ALTER TABLE public.conciliacao_saida_itens ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'despesa';
ALTER TABLE public.conciliacao_saida_itens ADD COLUMN IF NOT EXISTS descricao text NULL;
ALTER TABLE public.conciliacao_saida_itens ADD CONSTRAINT conciliacao_saida_itens_tipo_check CHECK (
  (tipo = 'despesa' AND despesa_id IS NOT NULL)
  OR (tipo = 'credito' AND despesa_id IS NULL AND coalesce(btrim(descricao),'') <> '' AND valor > 0));

DROP FUNCTION IF EXISTS public.fn_conciliar_saida_multiplas(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.fn_conciliar_saida_multiplas(p_movimento_id uuid, p_despesa_ids uuid[], p_creditos jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  m record;
  v_soma numeric;
  v_n int;
  v_conc uuid;
  v_cred numeric := 0;
  v_nc int;
  v_inval int;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  IF p_creditos IS NULL OR jsonb_typeof(p_creditos) <> 'array' THEN p_creditos := '[]'::jsonb; END IF;
  v_nc := jsonb_array_length(p_creditos);
  IF v_nc > 20 THEN RAISE EXCEPTION 'creditos_invalidos'; END IF;
  SELECT count(*) INTO v_inval FROM jsonb_array_elements(p_creditos) e
   WHERE coalesce(btrim(e->>'descricao'),'') = '' OR coalesce((e->>'valor')::numeric, 0) <= 0;
  IF v_inval > 0 THEN RAISE EXCEPTION 'creditos_invalidos'; END IF;
  SELECT coalesce(sum(round((e->>'valor')::numeric, 2)), 0) INTO v_cred FROM jsonb_array_elements(p_creditos) e;
  IF p_despesa_ids IS NULL OR cardinality(p_despesa_ids) < (CASE WHEN v_nc > 0 THEN 1 ELSE 2 END) THEN
    RAISE EXCEPTION 'selecione_varias'; END IF;
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
  IF abs(v_soma - v_cred - round(m.valor::numeric,2)) > 0.01 THEN RAISE EXCEPTION 'soma_diferente'; END IF;
  INSERT INTO public.conciliacoes_bancarias(movimento_id, tabela_origem, registro_id, tipo_match, confianca, criado_por)
  VALUES (p_movimento_id, 'despesas_multiplas', p_movimento_id, 'manual', 'exata', auth.uid()) RETURNING id INTO v_conc;
  INSERT INTO public.conciliacao_saida_itens(conciliacao_id, despesa_id, valor, marcou_conciliado)
  SELECT v_conc, d.id, d.valor, NOT d.conciliado FROM public.despesas d WHERE d.id = ANY(p_despesa_ids);
  INSERT INTO public.conciliacao_saida_itens(conciliacao_id, despesa_id, valor, tipo, descricao)
  SELECT v_conc, NULL, round((e->>'valor')::numeric,2), 'credito', left(btrim(e->>'descricao'),200)
  FROM jsonb_array_elements(p_creditos) e;
  UPDATE public.despesas SET conciliado = true, updated_by = auth.uid(), updated_at = now()
  WHERE id = ANY(p_despesa_ids) AND NOT conciliado;
  UPDATE public.conciliacao_avisos SET resolvido_em = now() WHERE movimento_id = p_movimento_id AND resolvido_em IS NULL;
  RETURN jsonb_build_object('ok', true, 'itens', v_n, 'soma', v_soma, 'creditos', v_cred);
END
$fn$;

REVOKE ALL ON FUNCTION public.fn_conciliar_saida_multiplas(uuid,uuid[],jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_conciliar_saida_multiplas(uuid,uuid[],jsonb) TO authenticated;