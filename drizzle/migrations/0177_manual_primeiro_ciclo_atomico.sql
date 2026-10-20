CREATE OR REPLACE FUNCTION public.fn_manual_primeiro_ciclo_liquidar(p_venda_id uuid, p_pagamento_id uuid, p_resultado jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v public.vendas; c public.cobrancas; pr public.pagamentos_rede; k public.contratos; n int; pago_em date; ja boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:'||p_venda_id::text,0));
 SELECT * INTO v FROM public.vendas WHERE id=p_venda_id FOR UPDATE;
 IF v.id IS NULL OR v.origem IS DISTINCT FROM 'manual' OR v.tipo_cobranca IS DISTINCT FROM 'recorrencia' OR v.status_pagamento IN ('cancelado','estornado') THEN RAISE EXCEPTION 'Venda manual recorrente inválida'; END IF;
 SELECT count(*) INTO n FROM public.contratos WHERE plano_id=v.plano_id AND aluno_id=v.aluno_id AND forma_pagamento='cartao_recorrencia';
 IF n<>1 THEN RAISE EXCEPTION 'Contrato do primeiro ciclo ausente ou ambíguo'; END IF;
 SELECT * INTO k FROM public.contratos WHERE plano_id=v.plano_id AND aluno_id=v.aluno_id AND forma_pagamento='cartao_recorrencia';
 SELECT count(*) INTO n FROM public.cobrancas WHERE contrato_id=k.id AND numero_ciclo=1 AND aluno_id=v.aluno_id;
 IF n<>1 THEN RAISE EXCEPTION 'Cobrança do primeiro ciclo ausente ou ambígua'; END IF;
 SELECT * INTO c FROM public.cobrancas WHERE contrato_id=k.id AND numero_ciclo=1 AND aluno_id=v.aluno_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('manual_cobranca:'||c.id::text,0));
 SELECT * INTO pr FROM public.pagamentos_rede WHERE id=p_pagamento_id FOR UPDATE;
 IF pr.id IS NULL OR pr.venda_id IS DISTINCT FROM v.id OR pr.amount IS DISTINCT FROM round(c.valor*100)::integer OR pr.amount<=0
   OR (pr.cobranca_id IS NOT NULL AND pr.cobranca_id<>c.id) OR (v.cobranca_id IS NOT NULL AND v.cobranca_id<>c.id)
   OR c.status NOT IN ('pendente','atrasado','pago') OR k.status IS DISTINCT FROM 'ativo'
 THEN RAISE EXCEPTION 'Pagamento, aluno, contrato ou valor divergente'; END IF;
 IF EXISTS (SELECT 1 FROM public.pagamentos_rede WHERE id<>pr.id AND status IN ('approved','pending') AND (cobranca_id=c.id OR venda_id=v.id)) THEN RAISE EXCEPTION 'Outro pagamento aprovado ou pendente para o ciclo'; END IF;
 SELECT count(*) INTO n FROM public.ciclos_credito WHERE contrato_id=k.id;
 IF n<>1 OR EXISTS(SELECT 1 FROM public.ciclos_credito WHERE contrato_id=k.id AND cobranca_id IS NOT NULL AND cobranca_id<>c.id) THEN RAISE EXCEPTION 'Ciclo de créditos ausente ou ambíguo'; END IF;
 IF p_resultado IS NOT NULL AND pr.status<>'approved' THEN
  IF pr.status<>'pending' OR p_resultado->>'return_code' IS DISTINCT FROM '00' OR NULLIF(p_resultado->>'tid','') IS NULL THEN RAISE EXCEPTION 'Resultado aprovado inválido'; END IF;
  UPDATE public.pagamentos_rede SET status='approved',tid=p_resultado->>'tid',nsu=p_resultado->>'nsu',authorization_code=p_resultado->>'authorization_code',return_code='00',return_message=p_resultado->>'return_message',raw_response=p_resultado->'raw_response' WHERE id=pr.id RETURNING * INTO pr;
 END IF;
 IF pr.status IS DISTINCT FROM 'approved' OR pr.return_code IS DISTINCT FROM '00' OR NULLIF(pr.tid,'') IS NULL THEN RAISE EXCEPTION 'Pagamento não aprovado'; END IF;
 IF p_resultado IS NOT NULL AND pr.tid IS DISTINCT FROM p_resultado->>'tid' THEN RAISE EXCEPTION 'TID divergente'; END IF;
 IF c.status='pago' AND c.tid IS NOT NULL AND c.tid<>pr.tid THEN RAISE EXCEPTION 'Cobrança paga com outro TID'; END IF;
 pago_em:=(pr.created_at AT TIME ZONE 'America/Sao_Paulo')::date;
 ja:=c.status='pago' AND c.tid=pr.tid AND pr.cobranca_id=c.id AND v.cobranca_id=c.id AND EXISTS(SELECT 1 FROM public.ciclos_credito WHERE contrato_id=k.id AND cobranca_id=c.id);
 IF NOT ja THEN
  UPDATE public.pagamentos_rede SET cobranca_id=c.id WHERE id=pr.id;
  UPDATE public.cobrancas SET status='pago',data_pagamento=pago_em,gateway='Rede',tid=pr.tid WHERE id=c.id;
  UPDATE public.vendas SET cobranca_id=c.id,status_pagamento='pago' WHERE id=v.id;
  UPDATE public.ciclos_credito SET cobranca_id=c.id WHERE contrato_id=k.id;
  UPDATE public.pagamento_parcelas pp SET status='pago',data_pagamento=pago_em FROM public.pagamentos pg WHERE pp.pagamento_id=pg.id AND pg.venda_id=v.id AND pp.status='pendente';
  INSERT INTO public.system_logs(modulo,acao,mensagem,payload) VALUES ('cobrancas','manual_primeiro_ciclo_liquidado','Primeiro ciclo manual conciliado atomicamente; sem novos créditos',jsonb_build_object('venda_id',v.id,'cobranca_id',c.id,'pagamento_id',pr.id,'tid',pr.tid,'nsu',pr.nsu,'valor_centavos',pr.amount));
 END IF;
 RETURN jsonb_build_object('handled',true,'success',true,'idempotente',ja,'tid',pr.tid,'pagamento_id',pr.id,'cobranca_id',c.id,'valor_centavos',pr.amount);
END $fn$;
REVOKE ALL ON FUNCTION public.fn_manual_primeiro_ciclo_liquidar(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_manual_primeiro_ciclo_liquidar(uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.fn_manual_primeiro_ciclo_reservar(p_venda_id uuid,p_chave text,p_kind text DEFAULT 'token',p_cartao_id uuid DEFAULT NULL,p_aluno_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v public.vendas; k public.contratos; c public.cobrancas; pr public.pagamentos_rede; n int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:'||p_venda_id::text,0));
 SELECT * INTO v FROM public.vendas WHERE id=p_venda_id FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
 IF v.origem IS DISTINCT FROM 'manual' OR v.tipo_cobranca IS DISTINCT FROM 'recorrencia' THEN RETURN jsonb_build_object('handled',false); END IF;
 IF v.status_pagamento IN ('cancelado','estornado') OR v.plano_id IS NULL THEN RAISE EXCEPTION 'Venda inválida'; END IF;
 IF p_aluno_id IS NOT NULL AND p_aluno_id<>v.aluno_id THEN RAISE EXCEPTION 'Aluno divergente'; END IF;
 SELECT count(*) INTO n FROM public.contratos WHERE plano_id=v.plano_id AND aluno_id=v.aluno_id AND forma_pagamento='cartao_recorrencia';
 IF n=0 AND NOT EXISTS(SELECT 1 FROM public.planos_catalogo WHERE id=v.catalogo_id AND versao IS NOT NULL) THEN RETURN jsonb_build_object('handled',false); END IF;
 IF n<>1 THEN RAISE EXCEPTION 'Contrato do primeiro ciclo ausente ou ambíguo'; END IF;
 SELECT * INTO k FROM public.contratos WHERE plano_id=v.plano_id AND aluno_id=v.aluno_id AND forma_pagamento='cartao_recorrencia';
 SELECT count(*) INTO n FROM public.cobrancas WHERE contrato_id=k.id AND numero_ciclo=1 AND aluno_id=v.aluno_id;
 IF n<>1 THEN RAISE EXCEPTION 'Cobrança do primeiro ciclo ausente ou ambígua'; END IF;
 SELECT * INTO c FROM public.cobrancas WHERE contrato_id=k.id AND numero_ciclo=1 AND aluno_id=v.aluno_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('manual_cobranca:'||c.id::text,0));
 IF k.status<>'ativo' OR c.valor<=0 OR c.status NOT IN ('pendente','atrasado','pago') OR (v.cobranca_id IS NOT NULL AND v.cobranca_id<>c.id) THEN RAISE EXCEPTION 'Contrato ou cobrança inválidos'; END IF;
 SELECT count(*) INTO n FROM public.pagamentos_rede WHERE status IN ('approved','pending') AND (venda_id=v.id OR cobranca_id=c.id);
 IF n>1 THEN RAISE EXCEPTION 'Pagamentos múltiplos; conciliação manual necessária'; END IF;
 IF n=1 THEN
  SELECT * INTO pr FROM public.pagamentos_rede WHERE status IN ('approved','pending') AND (venda_id=v.id OR cobranca_id=c.id) FOR UPDATE;
  IF pr.status='approved' THEN RETURN public.fn_manual_primeiro_ciclo_liquidar(v.id,pr.id,NULL); END IF;
  RETURN jsonb_build_object('handled',true,'success',false,'em_processamento',true,'idempotente',true,'pagamento_id',pr.id,'cobranca_id',c.id);
 END IF;
 IF c.status='pago' OR v.status_pagamento='pago' THEN RAISE EXCEPTION 'Pago sem comprovante aprovado; não recobrar'; END IF;
 IF p_cartao_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cartoes_salvos WHERE id=p_cartao_id AND aluno_id=v.aluno_id AND ativo) THEN RAISE EXCEPTION 'Cartão não pertence ao aluno ou inativo'; END IF;
 IF p_kind NOT IN ('token','credit') OR NULLIF(p_chave,'') IS NULL OR length(p_chave)>200 THEN RAISE EXCEPTION 'Reserva inválida'; END IF;
 SELECT count(*) INTO n FROM public.ciclos_credito WHERE contrato_id=k.id;
 IF n<>1 THEN RAISE EXCEPTION 'Ciclo de créditos ausente ou ambíguo'; END IF;
 INSERT INTO public.pagamentos_rede(venda_id,cobranca_id,amount,installments,kind,status,idempotency_key)
 VALUES(v.id,c.id,round(c.valor*100)::integer,1,p_kind,'pending',p_chave) RETURNING * INTO pr;
 RETURN jsonb_build_object('handled',true,'nova',true,'success',false,'pagamento_id',pr.id,'cobranca_id',c.id,'valor_centavos',pr.amount);
END $fn$;
REVOKE ALL ON FUNCTION public.fn_manual_primeiro_ciclo_reservar(uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_manual_primeiro_ciclo_reservar(uuid,text,text,uuid,uuid) TO service_role;