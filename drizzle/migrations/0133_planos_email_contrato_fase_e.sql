CREATE TABLE public.planos_2027_email_envios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid NOT NULL REFERENCES public.propostas_planos_2027(id), evento text NOT NULL, status text NOT NULL DEFAULT 'reservado', dados jsonb NOT NULL, reservado_em timestamptz NOT NULL DEFAULT now(), enviado_em timestamptz, erro text, UNIQUE(proposta_id,evento)
);
GRANT ALL ON public.planos_2027_email_envios TO service_role;
REVOKE ALL ON public.planos_2027_email_envios FROM anon, authenticated;
ALTER TABLE public.planos_2027_email_envios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_completo(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r public.propostas_planos_2027; a public.propostas_2027_aceites; c public.contratos; d jsonb; cr jsonb; t public.checkout_2027_tentativas; teste boolean;
BEGIN
 SELECT * INTO r FROM public.propostas_planos_2027 WHERE id=p_proposta_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO a FROM public.propostas_2027_aceites WHERE id=r.aceite_id AND proposta_id=r.id AND invalidado_em IS NULL;
 IF NOT FOUND OR a.hash_texto IS DISTINCT FROM public.fn_checkout_2027_hash(a.conteudo_html) THEN RETURN NULL; END IF;
 SELECT * INTO c FROM public.contratos WHERE id=r.contrato_id;
 SELECT * INTO t FROM public.checkout_2027_tentativas WHERE proposta_id=r.id AND status='aprovado' ORDER BY updated_at DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('atividade',atividade,'quantidade',quantidade_inicial,'ilimitado',ilimitado,'validade',data_validade) ORDER BY atividade),'[]'::jsonb) INTO cr FROM public.creditos_aluno WHERE origem_id=c.plano_id AND aluno_id=r.aluno_ativado_id;
 teste := coalesce(r.teste_admin,false) OR public.fn_checkout_2027_teste(r.id) OR r.ativacao_vinculo='teste' OR EXISTS(SELECT 1 FROM public.vendas WHERE id=r.venda_id AND origem='teste_2027');
 d := public.fn_checkout_2027_email_dados(r.id) - 'cpf_ultimos3';
 RETURN d || jsonb_build_object('teste_admin',coalesce(teste,false),'ativada_em',r.ativada_em,'data_inicio',c.data_inicio,'data_fim',c.data_fim,'creditos',cr,'pago_em',r.pago_em,'pago_centavos',coalesce(t.valor_centavos,r.valor_total_centavos),'pagamento_referencia',r.pagamento_tid_mascarado,'pagamento_nsu',r.pagamento_nsu,'contrato',jsonb_build_object('html',a.conteudo_html,'hash',a.hash_texto,'versao',a.template_versao,'regulamento_versao',a.regulamento_versao,'aceito_em',a.aceito_em));
END $fn$;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_email_completo(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_email_completo(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_email_reservar(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 UPDATE public.propostas_planos_2027 SET email_confirmacao_reservado_em=now() WHERE id=p_proposta_id AND pago_em IS NOT NULL AND ativada_em IS NOT NULL AND email_confirmacao_enviado_em IS NULL AND (email_confirmacao_reservado_em IS NULL OR email_confirmacao_reservado_em<now()-interval '10 minutes');
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN public.fn_checkout_2027_email_dados(p_proposta_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.fn_planos_email_reservar(p_proposta_id uuid,p_evento text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE r public.propostas_planos_2027; d jsonb; e public.planos_2027_email_envios;
BEGIN
 IF p_evento !~ '^(inicial|teste_seguro|reenvio:[0-9a-f-]{36})$' THEN RAISE EXCEPTION 'Evento inválido'; END IF;
 SELECT * INTO r FROM public.propostas_planos_2027 WHERE id=p_proposta_id FOR UPDATE;
 IF NOT FOUND OR r.pago_em IS NULL THEN RETURN NULL; END IF;
 IF p_evento<>'teste_seguro' AND r.ativada_em IS NULL THEN RETURN NULL; END IF;
 IF p_evento='inicial' AND r.email_confirmacao_enviado_em IS NOT NULL THEN RETURN NULL; END IF;
 IF coalesce((SELECT trim(both '"' from valor::text)='true' FROM public.sistema_config WHERE chave='planos_email_confirmacao_ativo'),false)=false THEN RETURN NULL; END IF;
 d:=public.fn_checkout_2027_email_completo(r.id);
 IF d IS NULL THEN RETURN NULL; END IF;
 IF p_evento='teste_seguro' AND NOT coalesce((d->>'teste_admin')::boolean,false) THEN RAISE EXCEPTION 'Teste não permitido'; END IF;
 IF coalesce((d->>'teste_admin')::boolean,false) THEN
  IF NOT EXISTS(SELECT 1 FROM public.alunos WHERE nome='NICOLAS TESTE' AND lower(email)='nicolas_ja@hotmail.com') THEN RAISE EXCEPTION 'Caixa de teste não validada'; END IF;
  d:=d||jsonb_build_object('email','nicolas_ja@hotmail.com');
 END IF;
 IF p_evento='teste_seguro' THEN d:=d||jsonb_build_object('ensaio',true); END IF;
 INSERT INTO public.planos_2027_email_envios(proposta_id,evento,dados) VALUES(r.id,p_evento,d) ON CONFLICT(proposta_id,evento) DO NOTHING RETURNING * INTO e;
 IF NOT FOUND THEN
  SELECT * INTO e FROM public.planos_2027_email_envios WHERE proposta_id=r.id AND evento=p_evento FOR UPDATE;
  IF e.status='enviado' OR (e.status='reservado' AND e.reservado_em>now()-interval '10 minutes') THEN RETURN NULL; END IF;
  UPDATE public.planos_2027_email_envios SET status='reservado',reservado_em=now(),erro=NULL WHERE id=e.id;
 END IF;
 RETURN jsonb_build_object('envio_id',e.id,'dados',e.dados,'idempotency_key','planos-email-'||e.id);
END $fn$;
REVOKE ALL ON FUNCTION public.fn_planos_email_reservar(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_planos_email_reservar(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_planos_email_resultado(p_envio_id uuid,p_enviado boolean,p_erro text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE e public.planos_2027_email_envios;
BEGIN
 UPDATE public.planos_2027_email_envios SET status=CASE WHEN p_enviado THEN 'enviado' ELSE 'falhou' END,enviado_em=CASE WHEN p_enviado THEN now() END,erro=CASE WHEN p_enviado THEN NULL ELSE left(p_erro,100) END WHERE id=p_envio_id AND status<>'enviado' RETURNING * INTO e;
 IF NOT FOUND THEN RETURN; END IF;
 IF e.evento<>'teste_seguro' THEN
  PERFORM public.fn_checkout_2027_email_resultado(e.proposta_id,p_enviado,p_erro);
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.fn_planos_email_resultado(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_planos_email_resultado(uuid,boolean,text) TO service_role;