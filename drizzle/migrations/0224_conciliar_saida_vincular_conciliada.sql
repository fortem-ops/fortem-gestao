CREATE OR REPLACE FUNCTION public.fn_conciliar_saida_vincular_conciliada(p_movimento_id uuid, p_despesa_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m record; d record;
BEGIN
  IF NOT public.fn_conciliacao_pode_editar() THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  SELECT * INTO m FROM public.inter_extrato_movimentos WHERE id = p_movimento_id FOR UPDATE;
  IF NOT FOUND OR m.tipo_operacao <> 'D' THEN RAISE EXCEPTION 'movimento_invalido'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE movimento_id = p_movimento_id AND NOT desfeito) THEN
    RAISE EXCEPTION 'movimento_ja_vinculado'; END IF;
  SELECT * INTO d FROM public.despesas WHERE id = p_despesa_id FOR UPDATE;
  IF NOT FOUND OR NOT d.conciliado THEN RAISE EXCEPTION 'despesa_invalida'; END IF;
  IF EXISTS (SELECT 1 FROM public.conciliacoes_bancarias WHERE registro_id = p_despesa_id AND NOT desfeito) THEN
    RAISE EXCEPTION 'despesa_ja_vinculada'; END IF;
  IF abs(d.valor - round(m.valor::numeric, 2)) >= 0.005 THEN RAISE EXCEPTION 'valor_diferente'; END IF;
  INSERT INTO public.conciliacoes_bancarias(movimento_id, tabela_origem, registro_id, tipo_match, confianca, criado_por)
  VALUES (p_movimento_id, 'despesas', p_despesa_id, 'manual',
          CASE WHEN d.data_pagamento = m.data_entrada THEN 'exata' ELSE 'aproximada' END, auth.uid());
  UPDATE public.conciliacao_avisos SET resolvido_em = now() WHERE movimento_id = p_movimento_id AND resolvido_em IS NULL;
  RETURN jsonb_build_object('ok', true);
END $function$;
REVOKE ALL ON FUNCTION public.fn_conciliar_saida_vincular_conciliada(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_conciliar_saida_vincular_conciliada(uuid, uuid) TO authenticated, service_role;