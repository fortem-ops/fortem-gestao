-- E5b-B PROPOSTA — NÃO APLICADA. Separa a policy do aluno; só o INSERT ganha a trava.
-- SELECT/UPDATE/DELETE com exatamente as mesmas expressões de hoje (UPDATE: mesmo USING e WITH CHECK).
-- staff_all_treino_agendamentos intocada.
DROP POLICY aluno_own_treino_agendamentos ON public.treino_agendamentos;
CREATE POLICY aluno_own_treino_agendamentos_select ON public.treino_agendamentos AS PERMISSIVE FOR SELECT TO public
  USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
CREATE POLICY aluno_own_treino_agendamentos_insert ON public.treino_agendamentos AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL) AND NOT public.fn_aluno_somente_online(aluno_id));
CREATE POLICY aluno_own_treino_agendamentos_update ON public.treino_agendamentos AS PERMISSIVE FOR UPDATE TO public
  USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
  WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
CREATE POLICY aluno_own_treino_agendamentos_delete ON public.treino_agendamentos AS PERMISSIVE FOR DELETE TO public
  USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
-- Observação: as RPCs SECURITY DEFINER (owner postgres) não passam por RLS; a trava delas é a Proposta A.
-- fn_aluno_somente_online exige que quem consulta seja o próprio aluno/equipe — no INSERT do aluno, é ele mesmo.
