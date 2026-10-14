CREATE FUNCTION public.fn_consultas_2027_cartao_liquidado(p_tentativa_id uuid,p_tid text,p_nsu text,p_autorizacao text,p_return_code text,p_valor_centavos integer,p_parcelas integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE t public.checkout_2027_tentativas; o public.planos_2027_pagamentos_avulsos;
BEGIN
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id=p_tentativa_id AND finalidade='consultas' AND tipo='cartao' FOR UPDATE;
 IF t.id IS NULL THEN RETURN jsonb_build_object('resultado','nao_encontrado'); END IF;
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=t.obrigacao_avulsa_id FOR UPDATE;
 IF t.status='aprovado' OR o.status IN ('pago','vendido') THEN RETURN jsonb_build_object('resultado','ja_processado'); END IF;
 IF t.status NOT IN ('pendente','processando','desconhecido') THEN RAISE EXCEPTION 'Tentativa encerrada'; END IF;
 IF p_valor_centavos IS DISTINCT FROM o.valor_centavos OR p_parcelas IS DISTINCT FROM o.parcelas THEN
  UPDATE public.checkout_2027_tentativas SET status='desconhecido',motivo='valor_divergente',updated_at=now() WHERE id=t.id;
  UPDATE public.planos_2027_pagamentos_avulsos SET status='desconhecido',erro='valor_divergente' WHERE id=o.id;
  RETURN jsonb_build_object('resultado','valor_divergente'); END IF;
 INSERT INTO public.pagamentos_rede(proposta_id,amount,installments,kind,tid,nsu,authorization_code,return_code,status,idempotency_key)
 VALUES(t.proposta_id,o.valor_centavos,o.parcelas,'token',p_tid,p_nsu,p_autorizacao,p_return_code,'approved','consultas:'||o.id||':'||t.id) ON CONFLICT DO NOTHING;
 UPDATE public.checkout_2027_tentativas SET status='aprovado',motivo=NULL,updated_at=now() WHERE id=t.id;
 -- Sem venda, créditos, ativação ou e-mail: isso é F5 (fn_consultas_2027_vender).
 UPDATE public.planos_2027_pagamentos_avulsos SET status='pago',pago_em=now(),tentativa_aprovada_id=t.id,erro=NULL WHERE id=o.id;
 RETURN jsonb_build_object('resultado','pago','creditos_liberados',false);
END $f$;
CREATE FUNCTION public.fn_consultas_2027_cartao_resultado(p_tentativa_id uuid,p_status text,p_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE t public.checkout_2027_tentativas; o public.planos_2027_pagamentos_avulsos;
BEGIN
 IF p_status NOT IN ('processando','recusado','desconhecido') THEN RAISE EXCEPTION 'Status inválido'; END IF;
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id=p_tentativa_id AND finalidade='consultas' AND tipo='cartao' FOR UPDATE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Tentativa não encontrada'; END IF;
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=t.obrigacao_avulsa_id FOR UPDATE;
 IF t.status='aprovado' OR o.status IN ('pago','vendido') THEN RETURN jsonb_build_object('resultado','ja_processado'); END IF;
 IF t.status NOT IN ('pendente','processando','desconhecido') THEN RAISE EXCEPTION 'Tentativa encerrada'; END IF;
 IF t.status='desconhecido' AND p_status='processando' THEN RAISE EXCEPTION 'Concilie antes de nova cobrança'; END IF;
 UPDATE public.checkout_2027_tentativas SET status=p_status,motivo=left(p_motivo,80),updated_at=now() WHERE id=t.id;
 UPDATE public.planos_2027_pagamentos_avulsos SET status=p_status,erro=left(p_motivo,80) WHERE id=o.id;
 RETURN jsonb_build_object('resultado',p_status);
END $f$;
REVOKE ALL ON FUNCTION public.fn_consultas_2027_cartao_liquidado(uuid,text,text,text,text,integer,integer),public.fn_consultas_2027_cartao_resultado(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_consultas_2027_cartao_liquidado(uuid,text,text,text,text,integer,integer),public.fn_consultas_2027_cartao_resultado(uuid,text,text) TO service_role;