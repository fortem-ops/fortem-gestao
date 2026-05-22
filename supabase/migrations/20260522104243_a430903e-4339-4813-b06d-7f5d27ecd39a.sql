CREATE POLICY "Coord/admin can update movements"
  ON public.pipeline_movements FOR UPDATE TO authenticated
  USING (is_coordinator_or_admin(auth.uid()))
  WITH CHECK (is_coordinator_or_admin(auth.uid()));