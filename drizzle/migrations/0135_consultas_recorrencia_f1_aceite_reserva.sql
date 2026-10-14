CREATE FUNCTION public.fn_consultas_2027_termo(p_proposta_id uuid,p_chave text,p_forma text,p_parcelas integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE p public.propostas_planos_2027; a public.propostas_2027_aceites; itens jsonb; total integer; n integer; texto text;
BEGIN
 p:=public.fn_checkout_2027_sessao(p_proposta_id,p_chave);
 IF p.forma_plano<>'recorrencia' OR p.familia NOT IN ('start_2027','power_2027','pro_2027') OR cardinality(p.servicos_codigos)=0 THEN RAISE EXCEPTION 'Consultas separadas indisponíveis'; END IF;
 SELECT * INTO a FROM public.propostas_2027_aceites WHERE id=p.aceite_id AND proposta_id=p.id AND invalidado_em IS NULL;
 IF a.id IS NULL OR a.hash_texto IS DISTINCT FROM public.fn_checkout_2027_hash(a.conteudo_html) THEN RAISE EXCEPTION 'Contrato precisa de aceite válido'; END IF;
 IF p_forma IS NULL OR p_forma NOT IN ('cartao_parcelado','pix_vista') OR p_parcelas IS NULL OR p_parcelas NOT BETWEEN 1 AND 6 OR (p_forma='pix_vista' AND p_parcelas<>1) THEN RAISE EXCEPTION 'Consultas em até 6x ou Pix à vista'; END IF;
 SELECT count(*),sum(round(s.valor*100))::integer,jsonb_agg(jsonb_build_object('catalogo_id',s.id,'codigo',s.codigo,'nome',s.nome,'valor_centavos',round(s.valor*100)::integer,'composicao',coalesce(s.composicao,jsonb_build_array(jsonb_build_object('atividade',s.atividade,'quantidade',s.quantidade_sessoes)))) ORDER BY s.codigo) INTO n,total,itens FROM public.servicos_catalogo s WHERE s.codigo=ANY(p.servicos_codigos) AND s.codigo IN ('nutri_4_comp_2_2027','nutri_8_2027','reab_4_2027','reab_8_2027') AND s.versao=2027 AND (public.fn_checkout_2027_teste(p.id) OR (s.ativo AND (s.vendavel_desde IS NULL OR s.vendavel_desde<=current_date) AND (s.vendavel_ate IS NULL OR s.vendavel_ate>=current_date)));
 IF n<>cardinality(p.servicos_codigos) OR total IS NULL OR total<=0 THEN RAISE EXCEPTION 'Pacote indisponível'; END IF;
 texto:='CONSULTAS — ACEITE ESPECÍFICO v1'||chr(10)||'Contrato aceito: '||a.hash_texto||chr(10)||'Itens e preços em centavos: '||itens::text||chr(10)||'Total: '||total||' centavos, sem desconto de Pix. Pagamento: '||p_forma||', '||p_parcelas||' parcela(s).'||chr(10)||'Pagamento separado do plano. O plano é ativado após a primeira mensalidade. Consultas são vendidas e todos os créditos liberados somente após confirmação do pagamento próprio, válidos por 12 meses desde a venda. Cancelamento do plano não retira consultas pagas nem extingue parcelas devidas, inclusive no combinado em até 12x. Consultas pendentes podem ser retomadas por 7 dias com este preço e aceite; depois exige novo aceite. Após cancelamento do plano, consultas pendentes exigem novo consentimento. Cartão das consultas exige captura e autorização próprias, sem reutilizar autorização da assinatura. Consultas não entram na recorrência automática. Estorno não altera automaticamente plano ou créditos.';
 RETURN jsonb_build_object('itens',itens,'valor_centavos',total,'forma',p_forma,'parcelas',p_parcelas,'termo_texto',texto,'termo_hash',public.fn_checkout_2027_hash(texto),'termo_versao',1,'aceite_plano_id',a.id);
END $f$;
CREATE FUNCTION public.fn_consultas_2027_aceitar(p_proposta_id uuid,p_chave text,p_forma text,p_parcelas integer,p_hash text,p_user_agent text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE d jsonb; p public.propostas_planos_2027; o public.planos_2027_pagamentos_avulsos; rev integer; instante timestamptz:=now();
BEGIN
 d:=public.fn_consultas_2027_termo(p_proposta_id,p_chave,p_forma,p_parcelas);
 SELECT * INTO p FROM public.propostas_planos_2027 WHERE id=p_proposta_id FOR UPDATE;
 IF p_hash IS DISTINCT FROM d->>'termo_hash' THEN RAISE EXCEPTION 'Leia e aceite o termo atual'; END IF;
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE proposta_id=p.id ORDER BY revisao DESC LIMIT 1 FOR UPDATE;
 IF o.id IS NOT NULL AND o.status IN ('processando','desconhecido','pago','vendido') THEN RAISE EXCEPTION 'Pagamento das consultas em andamento ou concluído'; END IF;
 IF o.id IS NOT NULL AND o.termo_hash=p_hash AND o.retomar_ate>instante AND o.cancelamento_no_aceite IS NOT DISTINCT FROM p.assinatura_cancelada_em AND o.status IN ('pendente','recusado') THEN RETURN jsonb_build_object('obrigacao_id',o.id,'repetida',true); END IF;
 IF EXISTS(SELECT 1 FROM public.checkout_2027_tentativas WHERE obrigacao_avulsa_id=o.id AND status IN ('pendente','processando','desconhecido','aprovado')) THEN RAISE EXCEPTION 'Concilie a tentativa anterior'; END IF;
 rev:=coalesce(o.revisao,0)+1;
 IF o.id IS NOT NULL THEN UPDATE public.planos_2027_pagamentos_avulsos SET status='substituido' WHERE id=o.id; END IF;
 INSERT INTO public.planos_2027_pagamentos_avulsos(proposta_id,aceite_plano_id,revisao,itens,valor_centavos,forma,parcelas,termo_texto,termo_hash,aceito_em,retomar_ate,user_agent,cancelamento_no_aceite,origem) VALUES(p.id,(d->>'aceite_plano_id')::uuid,rev,d->'itens',(d->>'valor_centavos')::integer,p_forma,p_parcelas,d->>'termo_texto',p_hash,instante,instante+interval '7 days',left(p_user_agent,512),p.assinatura_cancelada_em,CASE WHEN public.fn_checkout_2027_teste(p.id) THEN 'teste_admin' ELSE 'site' END) RETURNING * INTO o;
 RETURN jsonb_build_object('obrigacao_id',o.id,'repetida',false,'retomar_ate',o.retomar_ate);
END $f$;
CREATE FUNCTION public.fn_consultas_2027_estado(p_proposta_id uuid,p_chave text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE p public.propostas_planos_2027; o public.planos_2027_pagamentos_avulsos;
BEGIN
 p:=public.fn_checkout_2027_sessao(p_proposta_id,p_chave);
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE proposta_id=p.id ORDER BY revisao DESC LIMIT 1;
 IF o.id IS NULL THEN RETURN jsonb_build_object('estado','sem_aceite'); END IF;
 RETURN jsonb_build_object('obrigacao_id',o.id,'estado',o.status,'valor_centavos',o.valor_centavos,'forma',o.forma,'parcelas',o.parcelas,'retomar_ate',o.retomar_ate,'novo_aceite_exigido',o.status IN ('pendente','recusado','expirado') AND (o.retomar_ate<=now() OR o.cancelamento_no_aceite IS DISTINCT FROM p.assinatura_cancelada_em),'plano_ativo',p.ativada_em IS NOT NULL,'consultas_vendidas',o.vendido_em IS NOT NULL,'simulado',o.simulado);
END $f$;
CREATE FUNCTION public.fn_consultas_2027_reservar(p_obrigacao_id uuid,p_chave text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE o public.planos_2027_pagamentos_avulsos; p public.propostas_planos_2027; t public.checkout_2027_tentativas; n integer;
BEGIN
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=p_obrigacao_id;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Obrigação não encontrada'; END IF;
 p:=public.fn_checkout_2027_sessao(o.proposta_id,p_chave);
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=p_obrigacao_id FOR UPDATE;
 IF NOT public.fn_checkout_2027_teste(p.id) OR NOT o.simulado THEN RAISE EXCEPTION 'Consultas bloqueadas até liberação final'; END IF;
 IF p.pago_em IS NULL OR p.ativada_em IS NULL THEN RAISE EXCEPTION 'Ative o plano primeiro'; END IF;
 IF o.status NOT IN ('pendente','recusado') THEN RAISE EXCEPTION 'Consultas já em processamento ou concluídas'; END IF;
 IF o.retomar_ate<=now() OR o.cancelamento_no_aceite IS DISTINCT FROM p.assinatura_cancelada_em THEN RAISE EXCEPTION 'Novo consentimento necessário'; END IF;
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE obrigacao_avulsa_id=o.id AND status IN ('pendente','processando','desconhecido','aprovado') ORDER BY created_at DESC LIMIT 1;
 IF t.id IS NOT NULL THEN RETURN jsonb_build_object('tentativa_id',t.id,'reutilizada',true,'simulado',true); END IF;
 SELECT count(*) INTO n FROM public.checkout_2027_tentativas WHERE obrigacao_avulsa_id=o.id AND created_at>now()-interval '30 minutes';
 IF n>=3 THEN RAISE EXCEPTION 'Muitas tentativas de consultas'; END IF;
 INSERT INTO public.checkout_2027_tentativas(proposta_id,aceite_id,tipo,simulado,valor_centavos,total_proposta_centavos,parcelas,recorrencia,finalidade,obrigacao_avulsa_id,expira_em,ref) VALUES(p.id,o.aceite_plano_id,CASE o.forma WHEN 'pix_vista' THEN 'pix' ELSE 'cartao' END,true,o.valor_centavos,o.valor_centavos,o.parcelas,false,'consultas',o.id,CASE WHEN o.forma='pix_vista' THEN now()+interval '30 minutes' END,'consultas:'||gen_random_uuid()) RETURNING * INTO t;
 RETURN jsonb_build_object('tentativa_id',t.id,'reutilizada',false,'simulado',true,'valor_centavos',t.valor_centavos,'parcelas',t.parcelas);
END $f$;
CREATE FUNCTION public.fn_consultas_2027_resultado_simulado(p_tentativa_id uuid,p_chave text,p_resultado text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE t public.checkout_2027_tentativas; o public.planos_2027_pagamentos_avulsos; p public.propostas_planos_2027;
BEGIN
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id=p_tentativa_id AND finalidade='consultas';
 IF t.id IS NULL OR NOT t.simulado THEN RAISE EXCEPTION 'Somente simulação'; END IF;
 p:=public.fn_checkout_2027_sessao(t.proposta_id,p_chave);
 IF NOT public.fn_checkout_2027_teste(p.id) THEN RAISE EXCEPTION 'Somente proposta de teste'; END IF;
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=t.obrigacao_avulsa_id FOR UPDATE;
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id=p_tentativa_id FOR UPDATE;
 IF t.status='aprovado' OR o.status IN ('pago','vendido') THEN RETURN jsonb_build_object('ja_processado',true); END IF;
 IF p_resultado IS NULL OR p_resultado NOT IN ('aprovado','recusado','desconhecido','expirado') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
 IF t.status NOT IN ('pendente','processando','desconhecido') THEN RAISE EXCEPTION 'Tentativa encerrada'; END IF;
 UPDATE public.checkout_2027_tentativas SET status=p_resultado,updated_at=now() WHERE id=t.id;
 UPDATE public.planos_2027_pagamentos_avulsos SET status=CASE p_resultado WHEN 'aprovado' THEN 'pago' ELSE p_resultado END,pago_em=CASE WHEN p_resultado='aprovado' THEN now() END,tentativa_aprovada_id=CASE WHEN p_resultado='aprovado' THEN t.id END WHERE id=o.id;
 RETURN jsonb_build_object('estado',p_resultado,'simulado',true,'creditos_liberados',false);
END $f$;
REVOKE ALL ON FUNCTION public.fn_consultas_2027_termo(uuid,text,text,integer),public.fn_consultas_2027_aceitar(uuid,text,text,integer,text,text),public.fn_consultas_2027_estado(uuid,text),public.fn_consultas_2027_reservar(uuid,text),public.fn_consultas_2027_resultado_simulado(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_consultas_2027_termo(uuid,text,text,integer),public.fn_consultas_2027_aceitar(uuid,text,text,integer,text,text),public.fn_consultas_2027_estado(uuid,text),public.fn_consultas_2027_reservar(uuid,text),public.fn_consultas_2027_resultado_simulado(uuid,text,text) TO service_role;
