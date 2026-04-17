CREATE TABLE public.banco_treinos_escolhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_fase TEXT NOT NULL,
  treino_nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  exercicio_id UUID NOT NULL REFERENCES public.exercicios_personalizados(id) ON DELETE CASCADE,
  escolhido_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (template_fase, treino_nome, ordem)
);

CREATE INDEX idx_banco_treinos_escolhas_template ON public.banco_treinos_escolhas(template_fase);

ALTER TABLE public.banco_treinos_escolhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view escolhas"
ON public.banco_treinos_escolhas FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Coord/admin can insert escolhas"
ON public.banco_treinos_escolhas FOR INSERT
TO authenticated
WITH CHECK (is_coordinator_or_admin(auth.uid()) AND auth.uid() = escolhido_por);

CREATE POLICY "Coord/admin can update escolhas"
ON public.banco_treinos_escolhas FOR UPDATE
TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete escolhas"
ON public.banco_treinos_escolhas FOR DELETE
TO authenticated
USING (is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER update_banco_treinos_escolhas_updated_at
BEFORE UPDATE ON public.banco_treinos_escolhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();