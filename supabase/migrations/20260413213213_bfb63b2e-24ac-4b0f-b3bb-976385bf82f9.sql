
-- Fix permissive INSERT on alunos
DROP POLICY "Authenticated users can insert alunos" ON public.alunos;
CREATE POLICY "Authenticated users can insert alunos" ON public.alunos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = responsavel_id OR public.is_coordinator_or_admin(auth.uid()));

-- Fix permissive INSERT on avaliacao_funcional
DROP POLICY "Authenticated users can insert avaliacao_funcional" ON public.avaliacao_funcional;
CREATE POLICY "Authenticated users can insert avaliacao_funcional" ON public.avaliacao_funcional
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.avaliacoes
      WHERE avaliacoes.id = avaliacao_id AND avaliacoes.avaliador_id = auth.uid()
    )
    OR public.is_coordinator_or_admin(auth.uid())
  );
