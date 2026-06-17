ALTER TABLE public.agenda_servicos
  ADD COLUMN IF NOT EXISTS consultor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_consultor ON public.agenda_servicos(consultor_id);