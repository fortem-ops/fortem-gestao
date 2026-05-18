DROP POLICY IF EXISTS "Admin can delete avaliacoes" ON public.avaliacoes;
CREATE POLICY "Coord/Admin can delete avaliacoes"
  ON public.avaliacoes FOR DELETE
  USING (public.is_coordinator_or_admin(auth.uid()));