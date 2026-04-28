CREATE TABLE public.banco_treinos_personalizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banco_treinos_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view personalizados"
  ON public.banco_treinos_personalizados FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own personalizados"
  ON public.banco_treinos_personalizados FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Author or coord/admin can update personalizados"
  ON public.banco_treinos_personalizados FOR UPDATE
  TO authenticated USING (auth.uid() = criado_por OR public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Author or coord/admin can delete personalizados"
  ON public.banco_treinos_personalizados FOR DELETE
  TO authenticated USING (auth.uid() = criado_por OR public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER update_banco_treinos_personalizados_updated_at
  BEFORE UPDATE ON public.banco_treinos_personalizados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();