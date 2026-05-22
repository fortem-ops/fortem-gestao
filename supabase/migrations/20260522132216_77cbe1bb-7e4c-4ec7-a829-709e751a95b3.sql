
CREATE TABLE IF NOT EXISTS public.agenda_servicos_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.agenda_servicos(id) ON DELETE CASCADE,
  data_excecao date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agenda_id, data_excecao)
);

CREATE INDEX IF NOT EXISTS idx_agenda_excecoes_agenda ON public.agenda_servicos_excecoes(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_excecoes_data ON public.agenda_servicos_excecoes(data_excecao);

ALTER TABLE public.agenda_servicos_excecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view agenda excecoes"
ON public.agenda_servicos_excecoes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Prof/coord insert agenda excecoes"
ON public.agenda_servicos_excecoes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agenda_servicos a
    WHERE a.id = agenda_id
      AND (a.profissional_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()))
  )
);

CREATE POLICY "Prof/coord delete agenda excecoes"
ON public.agenda_servicos_excecoes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agenda_servicos a
    WHERE a.id = agenda_id
      AND (a.profissional_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()))
  )
);
