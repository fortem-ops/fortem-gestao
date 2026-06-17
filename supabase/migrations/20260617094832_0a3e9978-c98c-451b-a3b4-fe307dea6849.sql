DROP POLICY IF EXISTS "Admin can delete treinos" ON public.treinos;
CREATE POLICY "Staff (prof/coord/admin) can delete treinos"
ON public.treinos
FOR DELETE
USING (
  public.is_admin(auth.uid())
  OR public.is_coordinator_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'professor')
);