CREATE TABLE public.sistema_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.sistema_config TO authenticated;
GRANT INSERT, UPDATE ON public.sistema_config TO authenticated;
GRANT ALL ON public.sistema_config TO service_role;

ALTER TABLE public.sistema_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff le config do sistema"
  ON public.sistema_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "admin insere config do sistema"
  ON public.sistema_config FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin altera config do sistema"
  ON public.sistema_config FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_audit_sistema_config
  AFTER INSERT OR UPDATE OR DELETE ON public.sistema_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

INSERT INTO public.sistema_config (chave, valor, descricao)
VALUES (
  'cobranca_recorrente_ativa',
  'false'::jsonb,
  'Trava global da cobranca automatica no cartao (cobrar-recorrencias-diario). Padrao: pausada.'
);