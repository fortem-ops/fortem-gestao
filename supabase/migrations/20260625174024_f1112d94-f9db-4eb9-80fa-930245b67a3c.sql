
-- Enums
DO $$ BEGIN
  CREATE TYPE public.adquirente_bandeira AS ENUM ('visa','mastercard','elo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.adquirente_modalidade AS ENUM ('debito','credito_vista','credito_2_6x','credito_7_12x');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de taxas MDR
CREATE TABLE IF NOT EXISTS public.adquirentes_taxas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adquirente text NOT NULL DEFAULT 'rede',
  bandeira public.adquirente_bandeira NOT NULL,
  modalidade public.adquirente_modalidade NOT NULL,
  taxa_percentual numeric(5,2) NOT NULL DEFAULT 0 CHECK (taxa_percentual >= 0 AND taxa_percentual <= 100),
  prazo_recebimento_dias int,
  ativo boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adquirente, bandeira, modalidade)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adquirentes_taxas TO authenticated;
GRANT ALL ON public.adquirentes_taxas TO service_role;
ALTER TABLE public.adquirentes_taxas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adquirentes_taxas_select_auth" ON public.adquirentes_taxas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "adquirentes_taxas_admin_write" ON public.adquirentes_taxas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

-- Tabela de configuração do adquirente (aluguel etc.)
CREATE TABLE IF NOT EXISTS public.adquirentes_config (
  adquirente text PRIMARY KEY DEFAULT 'rede',
  aluguel_mensal numeric(10,2) NOT NULL DEFAULT 0 CHECK (aluguel_mensal >= 0),
  ativo boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adquirentes_config TO authenticated;
GRANT ALL ON public.adquirentes_config TO service_role;
ALTER TABLE public.adquirentes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adquirentes_config_select_auth" ON public.adquirentes_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "adquirentes_config_admin_write" ON public.adquirentes_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at_adquirente()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_adquirentes_taxas_updated ON public.adquirentes_taxas;
CREATE TRIGGER trg_adquirentes_taxas_updated BEFORE UPDATE ON public.adquirentes_taxas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at_adquirente();

DROP TRIGGER IF EXISTS trg_adquirentes_config_updated ON public.adquirentes_config;
CREATE TRIGGER trg_adquirentes_config_updated BEFORE UPDATE ON public.adquirentes_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at_adquirente();

-- Seed Rede: 12 combinações + config
INSERT INTO public.adquirentes_taxas (adquirente, bandeira, modalidade, taxa_percentual)
SELECT 'rede', b::public.adquirente_bandeira, m::public.adquirente_modalidade, 0
FROM unnest(ARRAY['visa','mastercard','elo']) b
CROSS JOIN unnest(ARRAY['debito','credito_vista','credito_2_6x','credito_7_12x']) m
ON CONFLICT (adquirente, bandeira, modalidade) DO NOTHING;

INSERT INTO public.adquirentes_config (adquirente, aluguel_mensal)
VALUES ('rede', 0)
ON CONFLICT (adquirente) DO NOTHING;
