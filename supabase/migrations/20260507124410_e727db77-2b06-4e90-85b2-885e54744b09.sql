-- Tabela de origens de leads gerenciáveis
CREATE TABLE public.lead_origens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lead_origens"
ON public.lead_origens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin can insert lead_origens"
ON public.lead_origens FOR INSERT TO authenticated
WITH CHECK (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can update lead_origens"
ON public.lead_origens FOR UPDATE TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete lead_origens"
ON public.lead_origens FOR DELETE TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER update_lead_origens_updated_at
BEFORE UPDATE ON public.lead_origens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed com as origens padrão
INSERT INTO public.lead_origens (nome, ordem) VALUES
  ('Indicação', 1),
  ('Fachada', 2),
  ('Instagram', 3),
  ('Ex-aluno', 4),
  ('Gympass/Wellhub', 5),
  ('Total Pass', 6),
  ('Parceiros', 7)
ON CONFLICT (nome) DO NOTHING;