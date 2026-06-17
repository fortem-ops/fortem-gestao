DROP POLICY IF EXISTS "Authenticated can view email config" ON public.notificacao_email_config;
CREATE POLICY "Staff can view email config" ON public.notificacao_email_config
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS view_insights ON public.relatorios_insights;
CREATE POLICY view_insights ON public.relatorios_insights
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));