CREATE TABLE public.pix_aut_renovacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grupo_id uuid NOT NULL REFERENCES public.pix_aut_grupos(id),
 plano_anterior_id uuid NOT NULL REFERENCES public.planos(id), plano_novo_id uuid NOT NULL REFERENCES public.planos(id),
 contrato_novo_id uuid REFERENCES public.contratos(id), venda_id uuid NOT NULL REFERENCES public.vendas(id),
 inicio date NOT NULL, ativada_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(plano_anterior_id,inicio), UNIQUE(plano_novo_id)
);
GRANT SELECT ON public.pix_aut_renovacoes TO authenticated;
GRANT ALL ON public.pix_aut_renovacoes TO service_role;
ALTER TABLE public.pix_aut_renovacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pix_aut_renovacoes_equipe ON public.pix_aut_renovacoes FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE OR REPLACE FUNCTION public.fn_pix_aut_preparar_renovacao(p_plano uuid,p_hoje date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pl planos%ROWTYPE; c planos_catalogo%ROWTYPE; k contratos%ROWTYPE; it pix_aut_itens%ROWTYPE;
 v_n uuid; v_k uuid; v_v uuid; v_fim date; v_val numeric; v_freq smallint; v_desc numeric; v_qtd int;
BEGIN
 IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE='42501'; END IF;
 SELECT * INTO pl FROM planos WHERE id=p_plano FOR UPDATE;
 IF NOT FOUND OR NOT pl.ativo OR NOT pl.renovacao_automatica OR pl.proxima_renovacao IS NULL
   OR p_hoje < pl.proxima_renovacao-8 OR p_hoje >= pl.proxima_renovacao THEN
   RETURN jsonb_build_object('pulado','fora_da_janela'); END IF;
 SELECT i.* INTO it FROM pix_aut_itens i JOIN pix_aut_grupos g ON g.id=i.grupo_id
  WHERE g.status='ativa' AND i.ativo_ate IS NULL AND (i.plano_id=pl.id OR i.contrato_id IN(SELECT id FROM contratos WHERE plano_id=pl.id)) FOR UPDATE OF i;
 IF it.id IS NULL THEN RETURN jsonb_build_object('pulado','fora_do_pix_ativo'); END IF;
 IF EXISTS(SELECT 1 FROM pix_aut_renovacoes WHERE plano_anterior_id=pl.id AND inicio=pl.proxima_renovacao) THEN
  RETURN jsonb_build_object('pulado','ja_preparado'); END IF;
 IF pl.catalogo_id IS NOT NULL THEN
  SELECT * INTO c FROM planos_catalogo WHERE id=pl.catalogo_id AND familia='start_2027';
 ELSE
  SELECT pc.* INTO c FROM vendas v JOIN planos_catalogo pc ON pc.id=v.catalogo_id
   WHERE v.plano_id=pl.id AND v.tipo='plano' AND pc.periodo_meses=1 ORDER BY v.created_at DESC LIMIT 1;
 END IF;
 IF c.id IS NULL THEN RAISE EXCEPTION 'catalogo_renovacao_nao_identificado'; END IF;
 SELECT * INTO k FROM contratos WHERE plano_id=pl.id AND status IN('ativo','inadimplente') ORDER BY created_at DESC LIMIT 1;
 v_fim := (pl.proxima_renovacao+interval '1 month')::date;
 v_desc := least(greatest(coalesce(pl.desconto_recorrente,0),0),coalesce(pl.valor,0));
 v_val := greatest(0,coalesce(pl.valor,0)-v_desc);
 v_freq := CASE c.frequencia::text WHEN '1x' THEN 1 WHEN '2x' THEN 2 WHEN '3x' THEN 3 WHEN 'livre' THEN 5 END;
 v_qtd := coalesce(c.quantidade_creditos,0);
 INSERT INTO planos(aluno_id,tipo,data_inicio,duracao_meses,valor,ativo,servicos,atividade,data_fim,catalogo_id,plano_codigo,
   forma_pagamento_padrao,parcelas_padrao,renovacao_automatica,proxima_renovacao,desconto_recorrente,observacoes)
 VALUES(pl.aluno_id,pl.tipo,pl.proxima_renovacao,1,CASE WHEN pl.catalogo_id IS NULL THEN v_val ELSE pl.valor END,false,
   pl.servicos,pl.atividade,v_fim,pl.catalogo_id,pl.plano_codigo,'pix_automatico',1,true,v_fim,pl.desconto_recorrente,pl.observacoes) RETURNING id INTO v_n;
 INSERT INTO vendas(aluno_id,tipo,catalogo_id,nome_snapshot,valor,desconto,valor_final,forma_pagamento,parcelas,status_pagamento,
  data_venda,origem,idempotency_key,plano_id)
 VALUES(pl.aluno_id,'plano',c.id,pl.tipo||' (renovação automática)',pl.valor,v_desc,v_val,'pix_automatico',1,'pendente',
  pl.proxima_renovacao,'renovacao_automatica','pixaut:'||pl.id||':'||pl.proxima_renovacao,v_n) RETURNING id INTO v_v;
 IF it.item_tipo='contrato' THEN
  INSERT INTO contratos(aluno_id,plano_id,plano_tipo,frequencia_semanal,creditos_total,vigencia_tipo,data_inicio,data_fim,
   forma_pagamento,valor_base,valor_cobrado,taxa_recorrencia,parcelas,status,criado_por,servicos_inclusos,catalogo_id)
  VALUES(pl.aluno_id,v_n,k.plano_tipo,coalesce(v_freq,k.frequencia_semanal),v_qtd,'mensal',pl.proxima_renovacao,v_fim,
   'pix_automatico',pl.valor,v_val,0,1,'suspenso',k.criado_por,k.servicos_inclusos,k.catalogo_id) RETURNING id INTO v_k;
  INSERT INTO ciclos_credito(contrato_id,creditos_liberados,data_inicio,data_fim,status)
   VALUES(v_k,v_qtd,pl.proxima_renovacao,v_fim-1,'suspenso');
  INSERT INTO cobrancas(contrato_id,aluno_id,numero_ciclo,valor,data_vencimento,status,forma_pagamento,meio_registro,descricao,composicao)
   VALUES(v_k,pl.aluno_id,1,v_val,pl.proxima_renovacao,'pendente','pix_automatico','automatico','Mensalidade '||pl.tipo,
    jsonb_build_object('plano',v_val,'servicos',0));
 END IF;
 UPDATE creditos_aluno SET ativo=false WHERE origem_id=v_v AND origem_tipo='plano';
 INSERT INTO pix_aut_renovacoes(grupo_id,plano_anterior_id,plano_novo_id,contrato_novo_id,venda_id,inicio)
  VALUES(it.grupo_id,pl.id,v_n,v_k,v_v,pl.proxima_renovacao);
 UPDATE pix_aut_itens SET ativo_ate=now() WHERE id=it.id;
 INSERT INTO pix_aut_itens(grupo_id,aluno_id,item_tipo,contrato_id,plano_id,descricao,valor,forma_anterior)
  VALUES(it.grupo_id,it.aluno_id,it.item_tipo,v_k,CASE WHEN it.item_tipo='plano' THEN v_n END,it.descricao,v_val,it.forma_anterior);
 UPDATE pix_aut_grupos SET valor_soma=(SELECT sum(valor) FROM pix_aut_itens WHERE grupo_id=it.grupo_id AND ativo_ate IS NULL),updated_at=now() WHERE id=it.grupo_id;
 INSERT INTO system_logs(modulo,acao,mensagem,payload) VALUES('pix-automatico-grupo','renovacao_programada','Próximo ciclo criado sem encerrar o atual',
  jsonb_build_object('grupo',it.grupo_id,'plano_anterior',pl.id,'plano_novo',v_n,'contrato',v_k,'venda',v_v,'inicio',pl.proxima_renovacao));
 RETURN jsonb_build_object('plano_id',v_n,'contrato_id',v_k,'venda_id',v_v,'inicio',pl.proxima_renovacao,'valor',v_val);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_preparar_renovacao(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_preparar_renovacao(uuid,date) TO service_role;
CREATE OR REPLACE FUNCTION public.fn_pix_aut_renovacoes_diario(p_hoje date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; a jsonb; v_preparados jsonb:='[]'; v_ativados jsonb:='[]'; v_falhas jsonb:='[]';
BEGIN
 IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE='42501'; END IF;
 FOR r IN SELECT * FROM pix_aut_renovacoes WHERE ativada_em IS NULL AND inicio<=p_hoje ORDER BY inicio FOR UPDATE LOOP
  UPDATE planos SET ativo=true WHERE id=r.plano_novo_id;
  UPDATE contratos SET status='ativo' WHERE id=r.contrato_novo_id AND status='suspenso';
  UPDATE ciclos_credito SET status='ativo' WHERE contrato_id=r.contrato_novo_id AND status='suspenso';
  UPDATE planos SET ativo=false WHERE id=r.plano_anterior_id;
  UPDATE contratos SET status='encerrado',observacoes=coalesce(observacoes||' | ','')||'Encerrado: renovado em '||r.inicio
    WHERE plano_id=r.plano_anterior_id AND status IN('ativo','suspenso','inadimplente');
  UPDATE ciclos_credito SET status='expirado' WHERE contrato_id IN(SELECT id FROM contratos WHERE plano_id=r.plano_anterior_id) AND status IN('ativo','suspenso');
  UPDATE creditos_aluno SET ativo=true WHERE origem_id=r.venda_id AND origem_tipo='plano';
  UPDATE pix_aut_renovacoes SET ativada_em=now() WHERE id=r.id;
  INSERT INTO system_logs(modulo,acao,mensagem,payload) VALUES('pix-automatico-grupo','renovacao_ativada','Ciclo assumiu na data de início',to_jsonb(r));
  v_ativados:=v_ativados||jsonb_build_object('plano',r.plano_novo_id,'inicio',r.inicio);
 END LOOP;
 FOR a IN SELECT * FROM jsonb_array_elements(public.fn_pix_aut_planos_antecipar(p_hoje)) LOOP
  BEGIN
   v_preparados:=v_preparados||public.fn_pix_aut_preparar_renovacao((a->>'plano_id')::uuid,p_hoje);
  EXCEPTION WHEN OTHERS THEN
   v_falhas:=v_falhas||jsonb_build_object('plano',a->>'plano_id','erro',SQLERRM);
   INSERT INTO system_logs(modulo,acao,mensagem,payload) VALUES('pix-automatico-grupo','renovacao_programada_falha',SQLERRM,a);
  END;
 END LOOP;
 RETURN jsonb_build_object('preparados',v_preparados,'ativados',v_ativados,'falhas',v_falhas);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_renovacoes_diario(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_renovacoes_diario(date) TO service_role;