CREATE OR REPLACE FUNCTION public.fn_checkout_2027_iniciar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_chave text; v_n int;
BEGIN
  IF NOT public.fn_checkout_2027_liberado(p_proposta_id) THEN RAISE EXCEPTION 'Checkout indisponível no momento'; END IF;
  v_chave := encode(extensions.gen_random_bytes(32),'hex');
  -- Chave entregue uma única vez, a quem acabou de criar a proposta (30 min); prévia só se marcada como teste de admin.
  UPDATE public.propostas_planos_2027
     SET chave_sessao_hash = public.fn_checkout_2027_hash(v_chave), etapa_checkout='identificada',
         etapa_atualizada_em=now(), expira_em = now() + interval '24 hours'
   WHERE id = p_proposta_id AND chave_sessao_hash IS NULL AND created_at > now() - interval '30 minutes'
     AND (coalesce(previa, false) = false OR coalesce(teste_admin, false) = true);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'Sessão inválida. Recomece a compra'; END IF;
  RETURN jsonb_build_object('chave_sessao', v_chave, 'etapa', 'identificada');
END $function$;
REVOKE EXECUTE ON FUNCTION public.fn_checkout_2027_iniciar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_iniciar(uuid) TO service_role;