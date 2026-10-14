BEGIN;
DO $test$
DECLARE p public.propostas_planos_2027; chave text:=repeat('f',40); d jsonb; r jsonb; o uuid; t uuid; a uuid; coord uuid; venda uuid; ids uuid[]; n int; origem_pago timestamptz;
BEGIN
 SELECT * INTO p FROM public.propostas_planos_2027 WHERE id='21511e24-9415-4b15-b4f0-707f7b909843' AND teste_admin;
 IF p.id IS NULL THEN RAISE EXCEPTION 'fixture ausente'; END IF;
 origem_pago:=p.pago_em;
 UPDATE public.propostas_planos_2027 SET assinatura_cancelada_em=NULL,assinatura_cancelada_por=NULL,chave_sessao_hash=public.fn_checkout_2027_hash(chave),servicos_codigos=ARRAY['nutri_4_comp_2_2027','reab_4_2027'],forma_servicos='cartao_parcelado',parcelas_servicos=6 WHERE id=p.id;
 d:=public.fn_consultas_2027_termo(p.id,chave,'cartao_parcelado',6);
 IF (d->>'valor_centavos')::int<>222000 THEN RAISE EXCEPTION 'preço errado'; END IF;
 BEGIN PERFORM public.fn_consultas_2027_termo(p.id,chave,'cartao_parcelado',7); RAISE EXCEPTION '7x permitido'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='7x permitido' THEN RAISE; END IF; END;
 BEGIN PERFORM public.fn_consultas_2027_termo(p.id,chave,'pix_vista',2); RAISE EXCEPTION 'Pix parcelado'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Pix parcelado' THEN RAISE; END IF; END;
 IF (public.fn_consultas_2027_termo(p.id,chave,'pix_vista',1)->>'valor_centavos')::int<>222000 THEN RAISE EXCEPTION 'desconto Pix'; END IF;
 r:=public.fn_consultas_2027_aceitar(p.id,chave,'cartao_parcelado',6,d->>'termo_hash'); o:=(r->>'obrigacao_id')::uuid;
 IF (SELECT retomar_ate-aceito_em FROM public.planos_2027_pagamentos_avulsos WHERE id=o)<>interval '7 days' THEN RAISE EXCEPTION 'prazo'; END IF;
 IF (public.fn_consultas_2027_aceitar(p.id,chave,'cartao_parcelado',6,d->>'termo_hash')->>'obrigacao_id')::uuid<>o THEN RAISE EXCEPTION 'aceite duplicado'; END IF;
 BEGIN UPDATE public.planos_2027_pagamentos_avulsos SET valor_centavos=1 WHERE id=o; RAISE EXCEPTION 'snapshot mutável'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='snapshot mutável' THEN RAISE; END IF; END;
 BEGIN PERFORM public.fn_consultas_2027_reservar(o,chave); RAISE EXCEPTION 'antes do plano'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='antes do plano' THEN RAISE; END IF; END;
 PERFORM public.fn_checkout_2027_ativar(p.id);
 IF EXISTS(SELECT 1 FROM public.vendas WHERE idempotency_key LIKE 'planos:'||p.id||':s%') THEN RAISE EXCEPTION 'consultas junto ao plano'; END IF;
 r:=public.fn_consultas_2027_reservar(o,chave); t:=(r->>'tentativa_id')::uuid;
 IF (public.fn_consultas_2027_reservar(o,chave)->>'tentativa_id')::uuid<>t THEN RAISE EXCEPTION 'reserva duplicada'; END IF;
 PERFORM public.fn_consultas_2027_resultado_simulado(t,chave,'desconhecido');
 BEGIN PERFORM public.fn_consultas_2027_reservar(o,chave); RAISE EXCEPTION 'retry desconhecido'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='retry desconhecido' THEN RAISE; END IF; END;
 PERFORM public.fn_consultas_2027_resultado_simulado(t,chave,'recusado');
 t:=(public.fn_consultas_2027_reservar(o,chave)->>'tentativa_id')::uuid;
 PERFORM public.fn_consultas_2027_resultado_simulado(t,chave,'aprovado');
 IF NOT (public.fn_consultas_2027_resultado_simulado(t,chave,'aprovado')->>'ja_processado')::boolean THEN RAISE EXCEPTION 'baixa duplicada'; END IF;
 BEGIN PERFORM public.fn_consultas_2027_vender(o); RAISE EXCEPTION 'simulação virou venda'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='simulação virou venda' THEN RAISE; END IF; END;
 IF (SELECT pago_em FROM public.propostas_planos_2027 WHERE id=p.id) IS DISTINCT FROM origem_pago THEN RAISE EXCEPTION 'baixa global alterada'; END IF;
 -- New isolated confirmed-payment fixture, not a real charge; no provider execution.
 INSERT INTO public.planos_2027_pagamentos_avulsos(proposta_id,aceite_plano_id,revisao,itens,valor_centavos,forma,parcelas,termo_texto,termo_hash,aceito_em,retomar_ate,simulado)
 SELECT proposta_id,aceite_plano_id,2,itens,valor_centavos,forma,parcelas,termo_texto,termo_hash,aceito_em,retomar_ate,false FROM public.planos_2027_pagamentos_avulsos WHERE id=o RETURNING id INTO o;
 INSERT INTO public.checkout_2027_tentativas(proposta_id,aceite_id,tipo,simulado,valor_centavos,total_proposta_centavos,parcelas,finalidade,obrigacao_avulsa_id,status)
 SELECT proposta_id,aceite_plano_id,'cartao',false,valor_centavos,valor_centavos,parcelas,'consultas',id,'aprovado' FROM public.planos_2027_pagamentos_avulsos WHERE id=o RETURNING id INTO t;
 UPDATE public.planos_2027_pagamentos_avulsos SET status='pago',pago_em=now(),tentativa_aprovada_id=t WHERE id=o;
 r:=public.fn_consultas_2027_vender(o);
 SELECT venda_ids INTO ids FROM public.planos_2027_pagamentos_avulsos WHERE id=o;
 IF cardinality(ids)<>2 THEN RAISE EXCEPTION 'vendas por item'; END IF;
 SELECT count(*) INTO n FROM public.creditos_aluno WHERE origem_id=ANY(ids);
 IF n<>3 OR EXISTS(SELECT 1 FROM public.creditos_aluno WHERE origem_id=ANY(ids) AND data_validade<>current_date+interval '12 months') THEN RAISE EXCEPTION 'créditos 12 meses'; END IF;
 IF (SELECT sum(quantidade_inicial) FROM public.creditos_aluno WHERE origem_id=ANY(ids))<>10 THEN RAISE EXCEPTION 'quantidades 4+2+4'; END IF;
 IF NOT (public.fn_consultas_2027_vender(o)->>'ja_vendido')::boolean THEN RAISE EXCEPTION 'venda duplicada'; END IF;
 SELECT user_id INTO coord FROM public.user_roles WHERE role='coordenador' LIMIT 1;
 SELECT user_id INTO a FROM public.user_roles WHERE role='admin' LIMIT 1;
 IF coord IS NULL OR a IS NULL THEN RAISE EXCEPTION 'roles ausentes'; END IF;
 PERFORM set_config('request.jwt.claim.sub',coord::text,true);
 BEGIN PERFORM public.fn_recorrencia_2027_cancelar(p.id); RAISE EXCEPTION 'coord cancelou'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'sem permissão' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 IF public.fn_recorrencia_2027_cancelar(p.id)->>'resultado'<>'cancelada' THEN RAISE EXCEPTION 'admin não cancelou'; END IF;
 IF (SELECT count(*) FROM public.creditos_aluno WHERE origem_id=ANY(ids) AND ativo)<>3 THEN RAISE EXCEPTION 'cancelamento retirou consultas'; END IF;
 IF pg_catalog.has_function_privilege('anon','public.fn_consultas_2027_reservar(uuid,text)','EXECUTE') OR pg_catalog.has_function_privilege('authenticated','public.fn_consultas_2027_reservar(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC pública'; END IF;
END $test$;
ROLLBACK;