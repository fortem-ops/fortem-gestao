-- Festa 10 anos v2: status/pagamento/acompanhantes/vouchers. Tabela original estava vazia.
DROP POLICY IF EXISTS festa_confirmacoes_public_insert ON public.festa_confirmacoes;
REVOKE ALL ON public.festa_confirmacoes FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_festa_confirmar(text, text, text, text, jsonb, integer) FROM anon, authenticated, public;
COMMENT ON FUNCTION public.fn_festa_confirmar(text, text, text, text, jsonb, integer) IS 'DEPRECATED: substituída pela função festa-confirmar';
COMMENT ON COLUMN public.festa_confirmacoes.acompanhantes IS 'DEPRECATED: substituída por festa_acompanhantes';

ALTER TABLE public.festa_confirmacoes
  ADD COLUMN IF NOT EXISTS consumo text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intolerancias text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_pagamento',
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'site',
  ADD COLUMN IF NOT EXISTS voucher_id uuid,
  ADD COLUMN IF NOT EXISTS total_centavos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS txid text,
  ADD COLUMN IF NOT EXISTS pix_copia_e_cola text,
  ADD COLUMN IF NOT EXISTS pix_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS pago_em timestamptz,
  ADD COLUMN IF NOT EXISTS pago_valor_centavos integer,
  ADD COLUMN IF NOT EXISTS pagamento_forma text,
  ADD COLUMN IF NOT EXISTS acesso_hash text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS atualizado_por uuid,
  ADD COLUMN IF NOT EXISTS criado_por uuid;

ALTER TABLE public.festa_confirmacoes
  ADD CONSTRAINT festa_conf_status_chk CHECK (status IN ('aguardando_pagamento','confirmado','isento','cancelado')),
  ADD CONSTRAINT festa_conf_origem_chk CHECK (origem IN ('site','manual'));

DROP INDEX IF EXISTS public.festa_confirmacoes_whatsapp_uidx;
CREATE UNIQUE INDEX festa_conf_whatsapp_ativo_uidx ON public.festa_confirmacoes (whatsapp) WHERE status <> 'cancelado';
CREATE UNIQUE INDEX festa_conf_txid_uidx ON public.festa_confirmacoes (txid) WHERE txid IS NOT NULL;
CREATE UNIQUE INDEX festa_conf_acesso_uidx ON public.festa_confirmacoes (acesso_hash) WHERE acesso_hash IS NOT NULL;

CREATE TABLE public.festa_acompanhantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmacao_id uuid NOT NULL REFERENCES public.festa_confirmacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  consumo text[] NOT NULL DEFAULT '{}',
  intolerancias text[] NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX festa_acomp_conf_idx ON public.festa_acompanhantes (confirmacao_id);

CREATE TABLE public.festa_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_hash text NOT NULL UNIQUE,
  descricao text,
  desconto_pct integer NOT NULL DEFAULT 100 CHECK (desconto_pct BETWEEN 1 AND 100),
  ativo boolean NOT NULL DEFAULT true,
  usos_max integer,
  usos integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.festa_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmacao_id uuid REFERENCES public.festa_confirmacoes(id) ON DELETE SET NULL,
  acao text NOT NULL,
  usuario_id uuid,
  detalhes jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.festa_rate_limit (
  chave text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX festa_rl_idx ON public.festa_rate_limit (chave, criado_em);

GRANT SELECT, INSERT, UPDATE ON public.festa_confirmacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festa_acompanhantes TO authenticated;
GRANT SELECT, INSERT ON public.festa_eventos TO authenticated;
GRANT ALL ON public.festa_confirmacoes, public.festa_acompanhantes, public.festa_vouchers, public.festa_eventos, public.festa_rate_limit TO service_role;

ALTER TABLE public.festa_acompanhantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festa_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festa_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festa_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_festa_gestao(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_uid) OR public.has_role(_uid, 'coordenador'::app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.fn_festa_gestao(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_festa_gestao(uuid) TO authenticated;

DROP POLICY IF EXISTS festa_confirmacoes_staff_select ON public.festa_confirmacoes;
DROP POLICY IF EXISTS festa_confirmacoes_staff_delete ON public.festa_confirmacoes;
CREATE POLICY festa_conf_gestao_select ON public.festa_confirmacoes FOR SELECT TO authenticated USING (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_conf_gestao_insert ON public.festa_confirmacoes FOR INSERT TO authenticated WITH CHECK (public.fn_festa_gestao(auth.uid()) AND origem = 'manual');
CREATE POLICY festa_conf_gestao_update ON public.festa_confirmacoes FOR UPDATE TO authenticated USING (public.fn_festa_gestao(auth.uid())) WITH CHECK (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_acomp_gestao_all ON public.festa_acompanhantes FOR ALL TO authenticated USING (public.fn_festa_gestao(auth.uid())) WITH CHECK (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_eventos_gestao_select ON public.festa_eventos FOR SELECT TO authenticated USING (public.fn_festa_gestao(auth.uid()));
CREATE POLICY festa_eventos_gestao_insert ON public.festa_eventos FOR INSERT TO authenticated WITH CHECK (public.fn_festa_gestao(auth.uid()) AND usuario_id = auth.uid());

-- Registro automático de quem alterou.
CREATE OR REPLACE FUNCTION public.fn_festa_conf_auditar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.atualizado_em := now();
  IF auth.uid() IS NOT NULL THEN NEW.atualizado_por := auth.uid(); END IF;
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    -- campos de pagamento do PIX só mudam pelo servidor
    NEW.txid := OLD.txid; NEW.pix_copia_e_cola := OLD.pix_copia_e_cola; NEW.acesso_hash := OLD.acesso_hash;
    INSERT INTO public.festa_eventos (confirmacao_id, acao, usuario_id, detalhes)
    VALUES (NEW.id, 'editado', auth.uid(), jsonb_build_object('status_antes', OLD.status, 'status_depois', NEW.status, 'forma', NEW.pagamento_forma));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER festa_conf_auditar BEFORE UPDATE ON public.festa_confirmacoes FOR EACH ROW EXECUTE FUNCTION public.fn_festa_conf_auditar();

-- Contador público: só o número.
CREATE OR REPLACE FUNCTION public.fn_festa_total_confirmados() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(c.pessoas), 0)::int FROM (
    SELECT 1 + (SELECT count(*) FROM public.festa_acompanhantes a WHERE a.confirmacao_id = f.id) AS pessoas
    FROM public.festa_confirmacoes f WHERE f.status IN ('confirmado','isento')
  ) c
$$;
REVOKE ALL ON FUNCTION public.fn_festa_total_confirmados() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_festa_total_confirmados() TO anon, authenticated;