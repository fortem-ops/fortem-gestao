
-- 1) alunos_self_update: include cpf_hash in immutable columns, restrict to authenticated
DROP POLICY IF EXISTS alunos_self_update ON public.alunos;
CREATE POLICY alunos_self_update ON public.alunos
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND NOT (user_id IS DISTINCT FROM (SELECT a.user_id FROM public.alunos a WHERE a.id = alunos.id))
  AND NOT (status IS DISTINCT FROM (SELECT a.status FROM public.alunos a WHERE a.id = alunos.id))
  AND NOT (responsavel_id IS DISTINCT FROM (SELECT a.responsavel_id FROM public.alunos a WHERE a.id = alunos.id))
  AND NOT (current_pipeline_stage_id IS DISTINCT FROM (SELECT a.current_pipeline_stage_id FROM public.alunos a WHERE a.id = alunos.id))
  AND NOT (frequencia_semanal IS DISTINCT FROM (SELECT a.frequencia_semanal FROM public.alunos a WHERE a.id = alunos.id))
  AND NOT (cpf IS DISTINCT FROM (SELECT a.cpf FROM public.alunos a WHERE a.id = alunos.id))
  AND NOT (cpf_hash IS DISTINCT FROM (SELECT a.cpf_hash FROM public.alunos a WHERE a.id = alunos.id))
);

-- 2) cartoes_salvos: cover null aluno_id rows
DROP POLICY IF EXISTS cartoes_update_admin_only ON public.cartoes_salvos;
CREATE POLICY cartoes_update_admin_only ON public.cartoes_salvos
FOR UPDATE TO authenticated
USING (is_admin_role() AND aluno_id IS NOT NULL)
WITH CHECK (is_admin_role() AND aluno_id IS NOT NULL);

-- 3) creditos_movimentos + creditos_aluno: restrict role from public to authenticated
DROP POLICY IF EXISTS creditos_mov_admin_all ON public.creditos_movimentos;
CREATE POLICY creditos_mov_admin_all ON public.creditos_movimentos
FOR ALL TO authenticated USING (is_admin_role()) WITH CHECK (is_admin_role());

DROP POLICY IF EXISTS creditos_mov_self_select ON public.creditos_movimentos;
CREATE POLICY creditos_mov_self_select ON public.creditos_movimentos
FOR SELECT TO authenticated
USING (credito_id IN (
  SELECT ca.id FROM public.creditos_aluno ca
  WHERE ca.aluno_id IN (SELECT a.id FROM public.alunos a WHERE a.user_id = auth.uid())
));

DROP POLICY IF EXISTS creditos_mov_staff_insert ON public.creditos_movimentos;
CREATE POLICY creditos_mov_staff_insert ON public.creditos_movimentos
FOR INSERT TO authenticated
WITH CHECK (is_professor_staff() AND registrado_por = auth.uid());

DROP POLICY IF EXISTS creditos_mov_staff_select ON public.creditos_movimentos;
CREATE POLICY creditos_mov_staff_select ON public.creditos_movimentos
FOR SELECT TO authenticated USING (is_professor_staff());

DROP POLICY IF EXISTS creditos_aluno_admin_all ON public.creditos_aluno;
CREATE POLICY creditos_aluno_admin_all ON public.creditos_aluno
FOR ALL TO authenticated USING (is_admin_role()) WITH CHECK (is_admin_role());

DROP POLICY IF EXISTS creditos_aluno_prof_select ON public.creditos_aluno;
CREATE POLICY creditos_aluno_prof_select ON public.creditos_aluno
FOR SELECT TO authenticated USING (is_professor_staff());

DROP POLICY IF EXISTS creditos_aluno_prof_update ON public.creditos_aluno;
CREATE POLICY creditos_aluno_prof_update ON public.creditos_aluno
FOR UPDATE TO authenticated USING (is_professor_staff());

DROP POLICY IF EXISTS creditos_aluno_self_select ON public.creditos_aluno;
CREATE POLICY creditos_aluno_self_select ON public.creditos_aluno
FOR SELECT TO authenticated
USING (aluno_id IN (SELECT a.id FROM public.alunos a WHERE a.user_id = auth.uid()));
