DO $patch$
DECLARE s text;
BEGIN
 SELECT pg_get_functiondef('public.fn_recorrencia_2027_cancelar(uuid)'::regprocedure) INTO s;
 IF position('(public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''coordenador''))' IN s)=0 THEN RAISE EXCEPTION 'Definição de cancelamento mudou'; END IF;
 s:=replace(s,'(public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''coordenador''))','public.has_role(auth.uid(),''admin'')');
 EXECUTE s;
 SELECT pg_get_functiondef('public.fn_checkout_2027_ativar(uuid)'::regprocedure) INTO s;
 IF position('''servicos'', v_servs,' IN s)=0 THEN RAISE EXCEPTION 'Definição de ativação mudou'; END IF;
 s:=replace(s,'''servicos'', v_servs,','''servicos'', CASE WHEN r.forma_plano = ''recorrencia'' THEN ''[]''::jsonb ELSE v_servs END,');
 EXECUTE s;
END $patch$;
CREATE FUNCTION public.fn_consultas_2027_vender(p_obrigacao_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE o public.planos_2027_pagamentos_avulsos; p public.propostas_planos_2027; item jsonb; comp jsonb; venda uuid; credito uuid; ids uuid[]:='{}'; data_venda date; teste boolean; t public.checkout_2027_tentativas;
BEGIN
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=p_obrigacao_id;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Obrigação não encontrada'; END IF;
 SELECT * INTO p FROM public.propostas_planos_2027 WHERE id=o.proposta_id FOR UPDATE;
 SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=p_obrigacao_id FOR UPDATE;
 IF o.vendido_em IS NOT NULL THEN RETURN jsonb_build_object('ja_vendido',true,'venda_ids',o.venda_ids); END IF;
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE id=o.tentativa_aprovada_id AND obrigacao_avulsa_id=o.id AND finalidade='consultas' AND status='aprovado';
 IF o.status<>'pago' OR o.pago_em IS NULL OR t.id IS NULL OR o.simulado OR t.simulado THEN RAISE EXCEPTION 'Venda exige pagamento confirmado, nunca simulação'; END IF;
 IF p.ativada_em IS NULL OR p.aluno_ativado_id IS NULL THEN RAISE EXCEPTION 'Plano ainda não ativado'; END IF;
 teste:=public.fn_checkout_2027_teste(p.id);
 -- F1 has no real reservation/settlement RPC. Future F3/F4 must supply verified provider payment first.
 IF teste AND NOT EXISTS(SELECT 1 FROM public.alunos a,public.sistema_config c WHERE a.id=p.aluno_ativado_id AND a.nome='NICOLAS TESTE' AND c.chave='vendas_2027_teste_aluno_ids' AND c.valor ? a.id::text) THEN RAISE EXCEPTION 'Teste somente NICOLAS TESTE'; END IF;
 data_venda:=(o.pago_em AT TIME ZONE 'America/Sao_Paulo')::date;
 FOR item IN SELECT * FROM jsonb_array_elements(o.itens) LOOP
  INSERT INTO public.vendas(aluno_id,tipo,catalogo_id,nome_snapshot,valor,desconto,valor_final,forma_pagamento,parcelas,status_pagamento,data_venda,tipo_cobranca,modalidade_pagamento,canal_pagamento,origem,idempotency_key) VALUES(p.aluno_ativado_id,'servico',(item->>'catalogo_id')::uuid,item->>'nome',(item->>'valor_centavos')::integer/100.0,0,(item->>'valor_centavos')::integer/100.0,CASE o.forma WHEN 'pix_vista' THEN 'pix' ELSE 'cartao_credito' END,o.parcelas,'pago',data_venda,'tradicional',o.forma,'online',CASE WHEN teste THEN 'teste_2027' ELSE 'site_2027' END,'consultas:'||o.id||':'||(item->>'codigo')) RETURNING id INTO venda;
  ids:=ids||venda;
  FOR comp IN SELECT * FROM jsonb_array_elements(item->'composicao') LOOP
   INSERT INTO public.creditos_aluno(aluno_id,origem_tipo,origem_id,atividade,quantidade_inicial,ilimitado,data_validade) VALUES(p.aluno_ativado_id,'servico',venda,comp->>'atividade',(comp->>'quantidade')::integer,false,(data_venda+interval '12 months')::date) RETURNING id INTO credito;
   INSERT INTO public.creditos_movimentos(credito_id,tipo,quantidade,observacao) VALUES(credito,'compra',(comp->>'quantidade')::integer,'Consulta 2027: '||(item->>'nome'));
  END LOOP;
 END LOOP;
 UPDATE public.planos_2027_pagamentos_avulsos SET status='vendido',vendido_em=now(),venda_ids=ids WHERE id=o.id;
 RETURN jsonb_build_object('vendida',true,'venda_ids',ids);
END $f$;
REVOKE ALL ON FUNCTION public.fn_consultas_2027_vender(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_consultas_2027_vender(uuid) TO service_role;
