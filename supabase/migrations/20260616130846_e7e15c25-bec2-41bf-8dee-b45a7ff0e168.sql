DROP POLICY IF EXISTS "Self or admin can view roles" ON public.user_roles;
CREATE POLICY "Self or coord/admin can view roles"
  ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR is_coordinator_or_admin(auth.uid()));