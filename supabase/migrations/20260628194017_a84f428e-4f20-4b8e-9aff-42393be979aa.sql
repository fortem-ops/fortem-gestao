CREATE TABLE IF NOT EXISTS public.ponto_consentimento_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aceito boolean NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  ip_aceite text,
  user_agent text,
  versao_termo text NOT NULL DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id)
);

COMMENT ON TABLE public.ponto_consentimento_geo IS
  'Registro de consentimento LGPD para coleta de geolocalização no módulo de ponto.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_consentimento_geo TO authenticated;
GRANT ALL ON public.ponto_consentimento_geo TO service_role;

ALTER TABLE public.ponto_consentimento_geo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario pode gerenciar proprio consentimento geo"
  ON public.ponto_consentimento_geo
  FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE TRIGGER trg_ponto_consentimento_geo_updated_at
  BEFORE UPDATE ON public.ponto_consentimento_geo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();