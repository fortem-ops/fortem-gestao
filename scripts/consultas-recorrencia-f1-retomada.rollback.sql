BEGIN;
DO $t$
DECLARE p public.propostas_planos_2027; k text:=repeat('h',40); d jsonb; o uuid; novo uuid;
BEGIN
 SELECT * INTO p FROM public.propostas_planos_2027 WHERE id='21511e24-9415-4b15-b4f0-707f7b909843' AND teste_admin;
 UPDATE public.propostas_planos_2027 SET chave_sessao_hash=public.fn_checkout_2027_hash(k),assinatura_cancelada_em=NULL,servicos_codigos=ARRAY['reab_4_2027'] WHERE id=p.id;
 PERFORM public.fn_checkout_2027_ativar(p.id);
 d:=public.fn_consultas_2027_termo(p.id,k,'pix_vista',1); o:=(public.fn_consultas_2027_aceitar(p.id,k,'pix_vista',1,d->>'termo_hash')->>'obrigacao_id')::uuid;
 UPDATE public.servicos_catalogo SET valor=601 WHERE codigo='reab_4_2027';
 IF (public.fn_consultas_2027_estado(p.id,k)->>'valor_centavos')::int<>60000 THEN RAISE EXCEPTION 'preço não congelado'; END IF;
 UPDATE public.propostas_planos_2027 SET assinatura_cancelada_em=now() WHERE id=p.id;
 BEGIN PERFORM public.fn_consultas_2027_reservar(o,k); RAISE EXCEPTION 'cancelado sem aceite'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Novo consentimento necessário' THEN RAISE; END IF; END;
 d:=public.fn_consultas_2027_termo(p.id,k,'pix_vista',1); novo:=(public.fn_consultas_2027_aceitar(p.id,k,'pix_vista',1,d->>'termo_hash')->>'obrigacao_id')::uuid;
 IF novo=o OR (SELECT status FROM public.planos_2027_pagamentos_avulsos WHERE id=o)<>'substituido' THEN RAISE EXCEPTION 'novo consentimento'; END IF;
 INSERT INTO public.planos_2027_pagamentos_avulsos(proposta_id,aceite_plano_id,revisao,itens,valor_centavos,forma,parcelas,termo_texto,termo_hash,aceito_em,retomar_ate,cancelamento_no_aceite)
 SELECT proposta_id,aceite_plano_id,3,itens,valor_centavos,forma,parcelas,termo_texto,termo_hash,now()-interval '8 days',now()-interval '1 day',cancelamento_no_aceite FROM public.planos_2027_pagamentos_avulsos WHERE id=novo RETURNING id INTO o;
 BEGIN PERFORM public.fn_consultas_2027_reservar(o,k); RAISE EXCEPTION 'prazo vencido permitido'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Novo consentimento necessário' THEN RAISE; END IF; END;
 UPDATE public.propostas_planos_2027 SET servicos_codigos=ARRAY['comp_corporal_avulsa_2027'] WHERE id=p.id;
 BEGIN PERFORM public.fn_consultas_2027_termo(p.id,k,'pix_vista',1); RAISE EXCEPTION 'avulsa permitida'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Pacote indisponível' THEN RAISE; END IF; END;
END $t$;
ROLLBACK;