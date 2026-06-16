DROP POLICY IF EXISTS "Author or coord/admin can delete personalizados" ON public.banco_treinos_personalizados;
CREATE POLICY "Staff can delete personalizados"
  ON public.banco_treinos_personalizados
  FOR DELETE TO authenticated
  USING (is_staff(auth.uid()));