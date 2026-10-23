-- E5b-B ROLLBACK: volta à policy única de hoje.
DROP POLICY IF EXISTS aluno_own_treino_agendamentos_select ON public.treino_agendamentos;
DROP POLICY IF EXISTS aluno_own_treino_agendamentos_insert ON public.treino_agendamentos;
DROP POLICY IF EXISTS aluno_own_treino_agendamentos_update ON public.treino_agendamentos;
DROP POLICY IF EXISTS aluno_own_treino_agendamentos_delete ON public.treino_agendamentos;
CREATE POLICY aluno_own_treino_agendamentos ON public.treino_agendamentos AS PERMISSIVE FOR ALL TO public
  USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
  WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
