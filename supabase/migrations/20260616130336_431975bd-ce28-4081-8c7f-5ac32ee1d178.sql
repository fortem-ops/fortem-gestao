DROP POLICY IF EXISTS "Staff can delete personalizados" ON public.banco_treinos_personalizados;
CREATE POLICY "Author or coord/admin can delete personalizados"
  ON public.banco_treinos_personalizados
  FOR DELETE TO authenticated
  USING ((auth.uid() = criado_por) OR is_coordinator_or_admin(auth.uid()));