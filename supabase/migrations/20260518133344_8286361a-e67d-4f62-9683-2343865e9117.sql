DROP POLICY IF EXISTS "Admin can view annexes" ON public.legal_annexes;
CREATE POLICY "Staff can view annexes" ON public.legal_annexes
  FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('professor','nutricionista','fisioterapeuta')
  ));