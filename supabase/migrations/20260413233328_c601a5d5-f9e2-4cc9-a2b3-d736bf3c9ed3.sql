
CREATE TABLE public.consumo_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  agenda_id UUID REFERENCES public.agenda_servicos(id) ON DELETE SET NULL,
  tipo_servico TEXT NOT NULL,
  data_consumo DATE NOT NULL DEFAULT CURRENT_DATE,
  registrado_por UUID NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consumo_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view consumo"
ON public.consumo_servicos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert consumo"
ON public.consumo_servicos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = registrado_por OR is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin can delete consumo"
ON public.consumo_servicos FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
