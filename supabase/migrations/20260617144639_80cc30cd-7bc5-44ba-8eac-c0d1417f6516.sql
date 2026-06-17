
-- 1) Restrict legal_annexes SELECT to authenticated role (was public/anon)
DROP POLICY IF EXISTS "Staff can view annexes" ON public.legal_annexes;

CREATE POLICY "Staff can view annexes"
ON public.legal_annexes
FOR SELECT
TO authenticated
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
      SELECT 1 FROM agenda_servicos a
      WHERE a.aluno_id = legal_annexes.aluno_id
        AND a.profissional_id = auth.uid()
    )
  )
);

-- 2) Storage SELECT policy for staff bound to aluno via agenda_servicos
-- File path convention assumed: <aluno_id>/<...>
DROP POLICY IF EXISTS "Staff can read legal annex attachments" ON storage.objects;

CREATE POLICY "Staff can read legal annex attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'legal_annex_attachments'
  AND (
    is_coordinator_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.legal_annexes la
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      JOIN public.agenda_servicos a
        ON a.aluno_id = la.aluno_id
       AND a.profissional_id = auth.uid()
      WHERE la.attachment_url IS NOT NULL
        AND position(storage.objects.name in la.attachment_url) > 0
        AND ur.role = ANY (ARRAY['professor'::app_role, 'nutricionista'::app_role, 'fisioterapeuta'::app_role])
    )
  )
);
