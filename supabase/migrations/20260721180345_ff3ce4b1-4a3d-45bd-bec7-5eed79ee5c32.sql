
-- Defense-in-depth: enforce column-level immutability in RLS WITH CHECK
DROP POLICY IF EXISTS alunos_self_update ON public.alunos;
CREATE POLICY alunos_self_update ON public.alunos
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND user_id IS NOT DISTINCT FROM (SELECT a.user_id FROM public.alunos a WHERE a.id = alunos.id)
  AND status IS NOT DISTINCT FROM (SELECT a.status FROM public.alunos a WHERE a.id = alunos.id)
  AND responsavel_id IS NOT DISTINCT FROM (SELECT a.responsavel_id FROM public.alunos a WHERE a.id = alunos.id)
  AND current_pipeline_stage_id IS NOT DISTINCT FROM (SELECT a.current_pipeline_stage_id FROM public.alunos a WHERE a.id = alunos.id)
  AND frequencia_semanal IS NOT DISTINCT FROM (SELECT a.frequencia_semanal FROM public.alunos a WHERE a.id = alunos.id)
  AND cpf IS NOT DISTINCT FROM (SELECT a.cpf FROM public.alunos a WHERE a.id = alunos.id)
);

-- Restrict custom workout bank reads to staff or creator
DROP POLICY IF EXISTS "Authenticated can view personalizados" ON public.banco_treinos_personalizados;
CREATE POLICY "Staff or creator can view personalizados"
ON public.banco_treinos_personalizados
FOR SELECT
TO authenticated
USING (public.is_professor_staff() OR criado_por = auth.uid());
