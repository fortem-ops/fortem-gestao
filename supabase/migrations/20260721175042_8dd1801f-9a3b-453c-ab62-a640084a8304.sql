DROP POLICY IF EXISTS "Staff can view email config" ON public.notificacao_email_config;
CREATE POLICY "Coord/admin can view email config" ON public.notificacao_email_config
  FOR SELECT TO authenticated
  USING (is_coordinator_or_admin(auth.uid()));