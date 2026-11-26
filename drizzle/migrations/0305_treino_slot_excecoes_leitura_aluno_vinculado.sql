ALTER POLICY aluno_read_treino_slot_excecoes ON public.treino_slot_excecoes
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.alunos AS aluno
    WHERE aluno.user_id = (SELECT auth.uid())
      AND aluno.is_equipe = false
  ));
COMMENT ON POLICY aluno_read_treino_slot_excecoes ON public.treino_slot_excecoes IS 'Shared schedule exceptions are readable only by linked students; staff access remains in the separate staff policy.';