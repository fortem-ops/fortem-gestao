CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pix_liquidado(p_txid text, p_valor_centavos integer, p_e2e text, p_raw jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.pix_cobrancas; t public.checkout_2027_tentativas; v_cob integer;
BEGIN
  SELECT * INTO c FROM public.pix_cobrancas
   WHERE txid = p_txid AND proposta_id IS NOT NULL AND pedido_id IS NULL AND corrida_venda_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('resultado','nao_encontrado'); END IF;
  SELECT * INTO t FROM public.checkout_2027_tentativas
   WHERE proposta_id = c.proposta_id AND tipo='pix' AND ref = p_txid ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF c.status = 'LIQUIDADA' AND (t.id IS NULL OR t.status = 'aprovado') THEN
    RETURN jsonb_build_object('resultado','ja_processado');
  END IF;
  v_cob := round(c.valor * 100)::integer;
  IF p_valor_centavos IS NULL OR p_valor_centavos <> v_cob THEN
    RETURN jsonb_build_object('resultado','valor_divergente','esperado',v_cob,'recebido',p_valor_centavos);
  END IF;
  UPDATE public.pix_cobrancas SET status='LIQUIDADA', liquidado_em=coalesce(liquidado_em, now()),
    raw_response = coalesce(p_raw, raw_response), updated_at=now() WHERE id = c.id;
  IF t.id IS NOT NULL AND t.status IN ('pendente','expirado') THEN
    UPDATE public.checkout_2027_tentativas SET status='aprovado', motivo=NULL, updated_at=now() WHERE id=t.id;
  END IF;
  UPDATE public.propostas_planos_2027 SET etapa_checkout='paga', pago_em=now(), pagamento_tipo='pix',
    pagamento_ref=p_txid, etapa_atualizada_em=now()
   WHERE id = c.proposta_id AND pago_em IS NULL;
  RETURN jsonb_build_object('resultado','baixado','proposta_id',c.proposta_id,'e2e',left(coalesce(p_e2e,''),64));
END $function$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_pix_liquidado(text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_pix_liquidado(text, integer, text, jsonb) TO service_role;