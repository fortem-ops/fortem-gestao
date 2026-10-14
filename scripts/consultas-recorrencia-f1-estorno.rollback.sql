BEGIN;
DO $t$
DECLARE al uuid; cat uuid; r jsonb; ct uuid; c uuid; v uuid; pr uuid; n int;
BEGIN
 SELECT a.id INTO al FROM public.alunos a,public.sistema_config sc WHERE a.nome='NICOLAS TESTE' AND sc.chave='vendas_2027_teste_aluno_ids' AND sc.valor ? a.id::text LIMIT 1;
 SELECT id INTO cat FROM public.planos_catalogo WHERE codigo='power_2027_2x_anual';
 r:=public.fn_venda_2027_gravar(jsonb_build_object('aluno_id',al,'catalogo_id',cat,'forma','cartao_parcelado','parcelas',3,'data_inicio',current_date,'idempotency_key','f1-rollback-estorno'),NULL,true,'teste_2027','online',false);
 ct:=(r->>'contrato_id')::uuid; v:=(r->>'venda_id')::uuid;
 UPDATE public.cobrancas SET status='pago',gateway='rede',tid='F1-FICTICIO',origem='teste_2027',data_pagamento=current_date WHERE contrato_id=ct;
 SELECT id INTO c FROM public.cobrancas WHERE contrato_id=ct AND numero_ciclo=1;
 SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id=v;
 INSERT INTO public.pagamentos_rede(cobranca_id,kind,status,amount,installments,tid,idempotency_key)
 SELECT c,'refund','pending',round(valor*100)::int,1,'F1-FICTICIO','f1-rollback-estorno-reserva' FROM public.cobrancas WHERE id=c RETURNING id INTO pr;
 r:=public.fn_estorno_confirmar(pr,'Ensaio desfeito',NULL,NULL,NULL,'00','fixture',NULL);
 IF NOT (r->>'ok')::boolean OR (SELECT saldo_estornavel FROM public.fn_cobranca_saldo_estornavel(c))<>0 THEN RAISE EXCEPTION 'estorno saldo'; END IF;
 IF (SELECT count(*) FROM public.creditos_aluno WHERE origem_id=v)<>n OR NOT EXISTS(SELECT 1 FROM public.planos p JOIN public.vendas s ON s.plano_id=p.id WHERE s.id=v AND p.ativo) OR (SELECT count(*) FROM public.cobrancas WHERE contrato_id=ct AND status='pago')<>2 THEN RAISE EXCEPTION 'estorno alterou demais'; END IF;
END $t$;
ROLLBACK;