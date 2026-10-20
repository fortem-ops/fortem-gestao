-- Ensaio NICOLAS TESTE; rollback obrigatório, sem chamadas à Rede.
BEGIN;
DO $test$
DECLARE r jsonb; a jsonb; b jsonb; v uuid; cb uuid; pr uuid; qtd int; cred int; failed boolean:=false;
BEGIN
 r:=public.fn_venda_2027_gravar(jsonb_build_object('aluno_id','085acf57-2dbe-464d-9acc-e1b0f5b77032','catalogo_id','c81432f2-d252-475c-8026-680ef7e01d95','forma','recorrencia','data_inicio','2026-10-20','servicos','[]'::jsonb,'idempotency_key',gen_random_uuid()),'66aa47d0-dc40-493d-8370-7d80eb54b8d6',true,'manual','manual',false);
 v:=(r->>'venda_id')::uuid;
 SELECT id INTO cb FROM public.cobrancas WHERE contrato_id=(r->>'contrato_id')::uuid AND numero_ciclo=1;
 UPDATE public.cobrancas SET valor=403 WHERE id=cb;
 UPDATE public.vendas SET desconto=196,valor_final=403 WHERE id=v;
 SELECT count(*) INTO cred FROM public.creditos_aluno WHERE origem_id=v;
 a:=public.fn_manual_primeiro_ciclo_reservar(v,gen_random_uuid()::text,'token');
 IF NOT (a->>'nova')::boolean OR (a->>'valor_centavos')::int<>40300 THEN RAISE EXCEPTION 'Falhou reserva/valor'; END IF;
 pr:=(a->>'pagamento_id')::uuid;
 b:=public.fn_manual_primeiro_ciclo_reservar(v,gen_random_uuid()::text,'token');
 IF b->>'em_processamento' IS DISTINCT FROM 'true' OR b->>'pagamento_id'<>pr::text THEN RAISE EXCEPTION 'Falhou trava/idempotência'; END IF;
 UPDATE public.pagamentos_rede SET amount=40200 WHERE id=pr;
 BEGIN
  PERFORM public.fn_manual_primeiro_ciclo_liquidar(v,pr,jsonb_build_object('tid','TEST-FIRST-CYCLE','return_code','00'));
 EXCEPTION WHEN OTHERS THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Valor divergente aceito'; END IF;
 UPDATE public.pagamentos_rede SET amount=40300 WHERE id=pr;
 a:=public.fn_manual_primeiro_ciclo_liquidar(v,pr,jsonb_build_object('tid','TEST-FIRST-CYCLE','nsu','TEST','return_code','00','raw_response',jsonb_build_object('returnCode','00')));
 IF a->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Falhou liquidação'; END IF;
 b:=public.fn_manual_primeiro_ciclo_reservar(v,gen_random_uuid()::text,'token');
 IF b->>'success' IS DISTINCT FROM 'true' OR b->>'idempotente' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Falhou reexecução aprovada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cobrancas WHERE id=cb AND status='pago' AND tid='TEST-FIRST-CYCLE')
 OR NOT EXISTS(SELECT 1 FROM public.vendas WHERE id=v AND cobranca_id=cb AND status_pagamento='pago')
 OR NOT EXISTS(SELECT 1 FROM public.ciclos_credito WHERE contrato_id=(r->>'contrato_id')::uuid AND cobranca_id=cb)
 THEN RAISE EXCEPTION 'Vínculos não atômicos'; END IF;
 SELECT count(*) INTO qtd FROM public.pagamentos_rede WHERE venda_id=v;
 IF qtd<>1 THEN RAISE EXCEPTION 'Pagamento duplicado'; END IF;
 SELECT count(*) INTO qtd FROM public.creditos_aluno WHERE origem_id=v;
 IF qtd<>cred THEN RAISE EXCEPTION 'Créditos duplicados'; END IF;
 UPDATE public.cobrancas SET status='pendente',tid=NULL,data_pagamento=NULL WHERE id=cb;
 UPDATE public.pagamentos_rede SET cobranca_id=NULL WHERE id=pr;
 UPDATE public.vendas SET cobranca_id=NULL WHERE id=v;
 UPDATE public.ciclos_credito SET cobranca_id=NULL WHERE contrato_id=(r->>'contrato_id')::uuid;
 b:=public.fn_manual_primeiro_ciclo_reservar(v,gen_random_uuid()::text,'token');
 IF b->>'success' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM public.cobrancas WHERE id=cb AND status='pago') THEN RAISE EXCEPTION 'Falhou conciliação de aprovado sem vínculo'; END IF;
END $test$;
ROLLBACK;