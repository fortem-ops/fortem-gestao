BEGIN;
DO $t$
DECLARE al uuid; cat uuid; sid uuid; r jsonb; p public.propostas_planos_2027; k text:=repeat('g',40); ct uuid;
BEGIN
 SELECT a.id INTO al FROM public.alunos a,public.sistema_config c WHERE a.nome='NICOLAS TESTE' AND c.chave='vendas_2027_teste_aluno_ids' AND c.valor ? a.id::text LIMIT 1;
 SELECT id INTO cat FROM public.planos_catalogo WHERE codigo='power_2027_2x_anual'; SELECT id INTO sid FROM public.servicos_catalogo WHERE codigo='reab_4_2027';
 r:=public.fn_venda_2027_gravar(jsonb_build_object('aluno_id',al,'catalogo_id',cat,'forma','cartao_parcelado','parcelas',12,'servicos',jsonb_build_array(sid),'data_inicio','2026-10-31','primeiro_vencimento','2026-10-31','idempotency_key','f1-rollback-balcao'),NULL,true,'teste_2027','manual',false);
 ct:=(r->>'contrato_id')::uuid;
 IF (SELECT count(*) FROM public.cobrancas WHERE contrato_id=ct)<>12 OR (SELECT data_vencimento FROM public.cobrancas WHERE contrato_id=ct AND numero_ciclo=5)<>'2027-02-28'::date THEN RAISE EXCEPTION 'parcelas combinado'; END IF;
 IF (SELECT count(*) FROM public.creditos_aluno WHERE origem_id=(r->'servico_venda_ids'->>0)::uuid AND quantidade_inicial=4)<>1 THEN RAISE EXCEPTION 'balcão serviço'; END IF;
 SELECT * INTO p FROM public.propostas_planos_2027 WHERE id='36ffd95b-35f7-4d7b-9c93-b42bf6dfc782' AND teste_admin;
 UPDATE public.propostas_planos_2027 SET forma_plano='pix_vista',pagamento_tipo='pix',servicos_codigos=ARRAY['reab_4_2027'],parcelas_plano=1 WHERE id=p.id;
 r:=public.fn_checkout_2027_ativar(p.id); ct:=(r->>'contrato_id')::uuid;
 IF (SELECT forma_pagamento FROM public.contratos WHERE id=ct)<>'pix' OR (SELECT count(*) FROM public.cobrancas WHERE contrato_id=ct AND status='pago' AND gateway='inter_pix')<>1 THEN RAISE EXCEPTION 'Pix plano'; END IF;
 IF public.fn_checkout_2027_email_completo(p.id) IS NULL THEN RAISE EXCEPTION 'Fase E'; END IF;
 SELECT * INTO p FROM public.propostas_planos_2027 WHERE id='21511e24-9415-4b15-b4f0-707f7b909843' AND teste_admin;
 UPDATE public.propostas_planos_2027 SET chave_sessao_hash=public.fn_checkout_2027_hash(k),pago_em=NULL,etapa_checkout='contrato_aceito',servicos_codigos=ARRAY['reab_4_2027'] WHERE id=p.id;
 UPDATE public.propostas_planos_2027 SET revisao=public.fn_checkout_2027_calcular(p.id) WHERE id=p.id;
 BEGIN PERFORM public.fn_checkout_2027_pagamento_iniciar(p.id,k,'cartao',NULL); RAISE EXCEPTION 'bloqueio abriu'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='bloqueio abriu' THEN RAISE; END IF; END;
END $t$;
ROLLBACK;