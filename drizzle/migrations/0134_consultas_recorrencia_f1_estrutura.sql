CREATE TABLE public.planos_2027_pagamentos_avulsos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid NOT NULL REFERENCES public.propostas_planos_2027(id),
 aceite_plano_id uuid NOT NULL REFERENCES public.propostas_2027_aceites(id), revisao integer NOT NULL,
 finalidade text NOT NULL DEFAULT 'consultas' CHECK(finalidade='consultas'), itens jsonb NOT NULL, valor_centavos integer NOT NULL CHECK(valor_centavos>0),
 forma text NOT NULL CHECK(forma IN ('cartao_parcelado','pix_vista')), parcelas integer NOT NULL CHECK(parcelas BETWEEN 1 AND 6),
 termo_texto text NOT NULL, termo_hash text NOT NULL, termo_versao integer NOT NULL DEFAULT 1,
 aceito_em timestamptz NOT NULL DEFAULT now(), user_agent text, origem text NOT NULL DEFAULT 'site',
 cancelamento_no_aceite timestamptz, retomar_ate timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','processando','desconhecido','recusado','pago','vendido','expirado','substituido')),
 tentativa_aprovada_id uuid, pago_em timestamptz, vendido_em timestamptz, venda_ids uuid[] NOT NULL DEFAULT '{}',
 simulado boolean NOT NULL DEFAULT true, erro text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(proposta_id,revisao), CHECK(forma<>'pix_vista' OR parcelas=1)
);
GRANT SELECT ON public.planos_2027_pagamentos_avulsos TO authenticated;
GRANT ALL ON public.planos_2027_pagamentos_avulsos TO service_role;
ALTER TABLE public.planos_2027_pagamentos_avulsos ENABLE ROW LEVEL SECURITY;
CREATE POLICY consultas_financeiro_leitura ON public.planos_2027_pagamentos_avulsos FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY consultas_servico ON public.planos_2027_pagamentos_avulsos FOR ALL TO service_role USING(true) WITH CHECK(true);
ALTER TABLE public.checkout_2027_tentativas ADD COLUMN finalidade text NOT NULL DEFAULT 'plano', ADD COLUMN obrigacao_avulsa_id uuid REFERENCES public.planos_2027_pagamentos_avulsos(id);
UPDATE public.checkout_2027_tentativas t SET finalidade='combinado' FROM public.propostas_planos_2027 p WHERE p.id=t.proposta_id AND p.forma_plano<>'recorrencia' AND cardinality(p.servicos_codigos)>0;
ALTER TABLE public.checkout_2027_tentativas ADD CONSTRAINT tentativa_finalidade_2027 CHECK(finalidade IN ('plano','consultas','combinado'));
ALTER TABLE public.planos_2027_pagamentos_avulsos ADD CONSTRAINT consultas_tentativa_aprovada_fk FOREIGN KEY(tentativa_aprovada_id) REFERENCES public.checkout_2027_tentativas(id);
CREATE UNIQUE INDEX consultas_tentativa_ativa ON public.checkout_2027_tentativas(obrigacao_avulsa_id) WHERE obrigacao_avulsa_id IS NOT NULL AND status IN ('pendente','processando','desconhecido','aprovado');
CREATE UNIQUE INDEX consultas_referencia ON public.checkout_2027_tentativas(ref) WHERE finalidade='consultas' AND ref IS NOT NULL;
COMMENT ON TABLE public.planos_2027_pagamentos_avulsos IS 'F1: obrigação/aceite independente e imutável; nenhuma integração pública/provedor habilitada. Consultas nunca entram no cron.';
CREATE FUNCTION public.fn_consultas_2027_guardar() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $f$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.proposta_id,NEW.aceite_plano_id,NEW.revisao,NEW.itens,NEW.valor_centavos,NEW.forma,NEW.parcelas,NEW.termo_texto,NEW.termo_hash,NEW.termo_versao,NEW.aceito_em,NEW.retomar_ate,NEW.cancelamento_no_aceite,NEW.user_agent,NEW.origem) IS DISTINCT FROM (OLD.proposta_id,OLD.aceite_plano_id,OLD.revisao,OLD.itens,OLD.valor_centavos,OLD.forma,OLD.parcelas,OLD.termo_texto,OLD.termo_hash,OLD.termo_versao,OLD.aceito_em,OLD.retomar_ate,OLD.cancelamento_no_aceite,OLD.user_agent,OLD.origem) THEN RAISE EXCEPTION 'Aceite de consultas imutável'; END IF;
 IF NEW.termo_hash IS DISTINCT FROM public.fn_checkout_2027_hash(NEW.termo_texto) THEN RAISE EXCEPTION 'Termo inválido'; END IF;
 IF NEW.retomar_ate IS DISTINCT FROM NEW.aceito_em+interval '7 days' THEN RAISE EXCEPTION 'Prazo de consultas inválido'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $f$;
CREATE TRIGGER consultas_snapshot BEFORE INSERT OR UPDATE ON public.planos_2027_pagamentos_avulsos FOR EACH ROW EXECUTE FUNCTION public.fn_consultas_2027_guardar();
CREATE FUNCTION public.fn_tentativa_finalidade_2027() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE o public.planos_2027_pagamentos_avulsos; p public.propostas_planos_2027;
BEGIN
 IF NEW.obrigacao_avulsa_id IS NOT NULL OR NEW.finalidade='consultas' THEN
  SELECT * INTO o FROM public.planos_2027_pagamentos_avulsos WHERE id=NEW.obrigacao_avulsa_id;
  IF o.id IS NULL OR NEW.finalidade<>'consultas' OR NEW.proposta_id<>o.proposta_id OR NEW.aceite_id IS DISTINCT FROM o.aceite_plano_id OR NEW.recorrencia OR NEW.valor_centavos<>o.valor_centavos OR NEW.total_proposta_centavos<>o.valor_centavos OR NEW.parcelas<>o.parcelas OR NEW.simulado<>o.simulado OR NEW.tipo<>(CASE o.forma WHEN 'pix_vista' THEN 'pix' ELSE 'cartao' END) THEN RAISE EXCEPTION 'Tentativa não corresponde às consultas'; END IF;
 ELSE
  IF TG_OP='INSERT' THEN
   SELECT * INTO p FROM public.propostas_planos_2027 WHERE id=NEW.proposta_id;
   NEW.finalidade:=CASE WHEN p.forma_plano<>'recorrencia' AND cardinality(p.servicos_codigos)>0 THEN 'combinado' ELSE 'plano' END;
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.proposta_id,NEW.finalidade,NEW.obrigacao_avulsa_id,NEW.aceite_id,NEW.valor_centavos,NEW.parcelas,NEW.simulado,NEW.recorrencia) IS DISTINCT FROM (OLD.proposta_id,OLD.finalidade,OLD.obrigacao_avulsa_id,OLD.aceite_id,OLD.valor_centavos,OLD.parcelas,OLD.simulado,OLD.recorrencia) THEN RAISE EXCEPTION 'Identidade da tentativa imutável'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER tentativa_finalidade BEFORE INSERT OR UPDATE ON public.checkout_2027_tentativas FOR EACH ROW EXECUTE FUNCTION public.fn_tentativa_finalidade_2027();
REVOKE ALL ON FUNCTION public.fn_consultas_2027_guardar(),public.fn_tentativa_finalidade_2027() FROM PUBLIC,anon,authenticated;
