CREATE TABLE public.prospect_nao_conversao_motivos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_nao_conversao_motivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view nao_conv_motivos"
ON public.prospect_nao_conversao_motivos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin can insert nao_conv_motivos"
ON public.prospect_nao_conversao_motivos FOR INSERT TO authenticated
WITH CHECK (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can update nao_conv_motivos"
ON public.prospect_nao_conversao_motivos FOR UPDATE TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete nao_conv_motivos"
ON public.prospect_nao_conversao_motivos FOR DELETE TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

INSERT INTO public.prospect_nao_conversao_motivos (nome, ordem) VALUES
  ('Financeiro', 1),
  ('Localização', 2),
  ('Outros', 3);