
-- 1. Add discount/payment columns to vendas
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS parcelas integer NOT NULL DEFAULT 1;

-- Backfill valor_final = valor for existing rows
UPDATE public.vendas SET valor_final = valor WHERE valor_final = 0 AND valor > 0;

-- 2. Add recurring billing config to planos
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS desconto_recorrente numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento_padrao text,
  ADD COLUMN IF NOT EXISTS parcelas_padrao integer NOT NULL DEFAULT 1;

-- 3. Catalog of payment methods
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  permite_parcelamento boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Authenticated can view formas_pagamento"
  ON public.formas_pagamento FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Coord/admin manage formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Coord/admin manage formas_pagamento"
  ON public.formas_pagamento FOR ALL TO authenticated
  USING (is_coordinator_or_admin(auth.uid()))
  WITH CHECK (is_coordinator_or_admin(auth.uid()));

-- Seed default payment methods
INSERT INTO public.formas_pagamento (nome, slug, permite_parcelamento, ordem) VALUES
  ('Pix', 'pix', false, 1),
  ('Cartão de Débito', 'cartao_debito', false, 2),
  ('Cartão de Crédito', 'cartao_credito', true, 3),
  ('Boleto', 'boleto', false, 4),
  ('Dinheiro', 'dinheiro', false, 5)
ON CONFLICT (slug) DO NOTHING;
