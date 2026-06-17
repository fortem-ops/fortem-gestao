DROP POLICY IF EXISTS "Staff can view annexes" ON public.legal_annexes;

CREATE POLICY "Staff can view annexes"
ON public.legal_annexes
FOR SELECT
USING (
  is_coordinator_or_admin(auth.uid())
  OR (
    aluno_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY['professor'::app_role, 'nutricionista'::app_role, 'fisioterapeuta'::app_role])
    )
    AND EXISTS (
      SELECT 1 FROM public.agenda_servicos a
      WHERE a.aluno_id = legal_annexes.aluno_id
        AND a.profissional_id = auth.uid()
    )
  )
);