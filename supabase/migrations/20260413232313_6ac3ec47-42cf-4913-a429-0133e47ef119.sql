
CREATE TABLE public.agenda_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade TEXT NOT NULL,
  local TEXT NOT NULL,
  dia_semana INTEGER NOT NULL, -- 0=domingo, 1=segunda ... 6=sábado
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'fixo', -- 'fixo' ou 'avulso'
  data_especifica DATE, -- apenas para avulsos
  profissional_id UUID NOT NULL,
  aluno_id UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agenda"
ON public.agenda_servicos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Professionals can insert own agenda"
ON public.agenda_servicos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profissional_id OR is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Professionals can update own agenda"
ON public.agenda_servicos FOR UPDATE
TO authenticated
USING (auth.uid() = profissional_id OR is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete agenda"
ON public.agenda_servicos FOR DELETE
TO authenticated
USING (auth.uid() = profissional_id OR is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER update_agenda_servicos_updated_at
BEFORE UPDATE ON public.agenda_servicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
