-- R1: mensalidades de recorrência no cartão dos planos 2027, isoladas das cobranças antigas.
CREATE TABLE public.planos_2027_mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas_planos_2027(id),
  tokenizacao_id uuid NOT NULL REFERENCES public.rede_tokenizacoes(id),
  contrato_id uuid NULL,
  numero smallint NOT NULL CHECK (numero >= 1),
  competencia date NOT NULL,
  vencimento date NOT NULL,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','processando','desconhecido','pago','recusado','inadimplente','cancelado')),
  tentativas smallint NOT NULL DEFAULT 0,
  proxima_tentativa_em date NULL,
  referencia text NULL,
  tid text NULL,
  motivo text NULL,
  simulado boolean NOT NULL DEFAULT false,
  pago_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposta_id, competencia),
  UNIQUE (proposta_id, numero)
);
GRANT SELECT ON public.planos_2027_mensalidades TO authenticated;
GRANT ALL ON public.planos_2027_mensalidades TO service_role;
ALTER TABLE public.planos_2027_mensalidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem mensalidades 2027" ON public.planos_2027_mensalidades
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX planos_2027_mensalidades_devidas_idx ON public.planos_2027_mensalidades (status, vencimento);

-- Escopo duro: token precisa ser da mesma proposta; valor/proposta/competência imutáveis.
CREATE OR REPLACE FUNCTION public.fn_mensalidade_2027_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rede_tokenizacoes t WHERE t.id = NEW.tokenizacao_id AND t.proposta_id = NEW.proposta_id) THEN
    RAISE EXCEPTION 'token não pertence à proposta';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.proposta_id <> OLD.proposta_id OR NEW.competencia <> OLD.competencia
      OR NEW.valor_centavos <> OLD.valor_centavos OR NEW.numero <> OLD.numero) THEN
    RAISE EXCEPTION 'campos imutáveis';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' AND NEW.status <> 'pago' THEN
    RAISE EXCEPTION 'mensalidade paga não muda de status';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mensalidade_2027_validar BEFORE INSERT OR UPDATE ON public.planos_2027_mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_mensalidade_2027_validar();

-- Devidas: só mensalidades 2027, chave ligada ('true' explícito; ausente = desligado).
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_devidas(p_hoje date, p_limite int DEFAULT 50)
RETURNS SETOF public.planos_2027_mensalidades LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.* FROM planos_2027_mensalidades m
  JOIN rede_tokenizacoes t ON t.id = m.tokenizacao_id AND t.proposta_id = m.proposta_id AND t.status = 'active'
  WHERE EXISTS (SELECT 1 FROM sistema_config c WHERE c.chave = 'planos_recorrencia_ativa' AND replace(c.valor::text,'"','') = 'true')
    AND m.numero > 1
    AND m.status IN ('pendente','recusado')
    AND m.tentativas < 3
    AND COALESCE(m.proxima_tentativa_em, m.vencimento) <= p_hoje
  ORDER BY m.vencimento, m.id
  LIMIT LEAST(GREATEST(p_limite, 0), 50);
$$;

-- Reserva atômica: só uma execução cobra cada mensalidade; referência determinística por tentativa.
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_reservar(p_id uuid)
RETURNS public.planos_2027_mensalidades LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r planos_2027_mensalidades;
BEGIN
  UPDATE planos_2027_mensalidades
     SET status = 'processando', tentativas = tentativas + 1,
         referencia = 'P27' || substr(replace(id::text,'-',''),1,12) || 'T' || (tentativas + 1)
   WHERE id = p_id AND status IN ('pendente','recusado') AND tentativas < 3
  RETURNING * INTO r;
  RETURN r;  -- nulo = já reservada/paga/esgotada
END $$;

-- Resultado: aprovado → pago; recusado → retentativa D+1, D+3, depois inadimplente; incerto → desconhecido.
CREATE OR REPLACE FUNCTION public.fn_recorrencia_2027_resultado(p_id uuid, p_resultado text, p_tid text, p_motivo text, p_hoje date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r planos_2027_mensalidades;
BEGIN
  SELECT * INTO r FROM planos_2027_mensalidades WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR r.status NOT IN ('processando','desconhecido') THEN RETURN 'ignorado'; END IF;
  IF p_resultado = 'aprovado' THEN
    UPDATE planos_2027_mensalidades SET status='pago', tid=left(p_tid,40), motivo=NULL, pago_em=now(), proxima_tentativa_em=NULL WHERE id=p_id;
  ELSIF p_resultado = 'recusado' THEN
    UPDATE planos_2027_mensalidades
       SET status = CASE WHEN r.tentativas >= 3 THEN 'inadimplente' ELSE 'recusado' END,
           motivo = left(p_motivo,120),
           proxima_tentativa_em = CASE r.tentativas WHEN 1 THEN p_hoje + 1 WHEN 2 THEN p_hoje + 2 ELSE NULL END
     WHERE id=p_id;
  ELSIF p_resultado = 'desconhecido' THEN
    UPDATE planos_2027_mensalidades SET status='desconhecido', motivo=left(p_motivo,120) WHERE id=p_id;
  ELSE RAISE EXCEPTION 'resultado inválido';
  END IF;
  SELECT status INTO r.status FROM planos_2027_mensalidades WHERE id=p_id;
  RETURN r.status;
END $$;

REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_devidas(date,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_reservar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recorrencia_2027_resultado(uuid,text,text,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_devidas(date,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_reservar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recorrencia_2027_resultado(uuid,text,text,text,date) TO service_role;