-- E5b-B ANTES (capturado em 2026-10-23, somente leitura). Tabela public.treino_agendamentos, RLS ligada.
-- aluno_own_treino_agendamentos | PERMISSIVE | TO public | FOR ALL
--   USING      ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
--   WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
-- staff_all_treino_agendamentos | PERMISSIVE | TO public | FOR ALL USING (is_staff()) WITH CHECK (is_staff())   -- NÃO muda
CREATE POLICY aluno_own_treino_agendamentos ON public.treino_agendamentos AS PERMISSIVE FOR ALL TO public
  USING ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL))
  WITH CHECK ((aluno_id = fn_current_aluno_id()) AND (auth.uid() IS NOT NULL));
