ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS consultor_id uuid;

COMMENT ON COLUMN public.alunos.consultor_id IS 'Consultor responsável (comercial) do aluno.';

CREATE INDEX IF NOT EXISTS idx_alunos_consultor ON public.alunos(consultor_id);

UPDATE public.alunos a
SET consultor_id = pm.responsavel_comercial_id
FROM public.pipeline_metadata pm
WHERE pm.aluno_id = a.id
  AND pm.responsavel_comercial_id IS NOT NULL
  AND a.consultor_id IS NULL;

DROP POLICY IF EXISTS "Consultor can view tarefas do aluno" ON public.tarefas;
CREATE POLICY "Consultor can view tarefas do aluno"
ON public.tarefas
FOR SELECT
TO authenticated
USING (
  tarefas.aluno_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.alunos al
    WHERE al.id = tarefas.aluno_id
      AND al.consultor_id = auth.uid()
  )
);