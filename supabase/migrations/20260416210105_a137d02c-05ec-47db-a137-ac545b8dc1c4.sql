
CREATE TABLE public.exercicios_personalizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  grupos JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exercicios_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view exercicios"
  ON public.exercicios_personalizados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coord/admin can insert exercicios"
  ON public.exercicios_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()) AND auth.uid() = criado_por);

CREATE POLICY "Coord/admin can update exercicios"
  ON public.exercicios_personalizados FOR UPDATE
  TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete exercicios"
  ON public.exercicios_personalizados FOR DELETE
  TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER update_exercicios_personalizados_updated_at
  BEFORE UPDATE ON public.exercicios_personalizados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
