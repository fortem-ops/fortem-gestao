
-- 1) acordos-intervalo storage policies: rescope from public to authenticated
DROP POLICY IF EXISTS "Admin/coord atualizam PDFs de acordo" ON storage.objects;
DROP POLICY IF EXISTS "Admin/coord enviam PDFs de acordo" ON storage.objects;
DROP POLICY IF EXISTS "Admin/coord leem PDFs de acordo" ON storage.objects;
DROP POLICY IF EXISTS "Admin/coord removem PDFs de acordo" ON storage.objects;
DROP POLICY IF EXISTS "Dono lê próprios PDFs de acordo" ON storage.objects;

CREATE POLICY "Admin/coord leem PDFs de acordo"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'acordos-intervalo' AND is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin/coord enviam PDFs de acordo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'acordos-intervalo' AND is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin/coord atualizam PDFs de acordo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'acordos-intervalo' AND is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Admin/coord removem PDFs de acordo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'acordos-intervalo' AND is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Dono lê próprios PDFs de acordo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'acordos-intervalo'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2) legal_annex_attachments: tighten staff read to exact-path match
DROP POLICY IF EXISTS "Staff can read legal annex attachments" ON storage.objects;

CREATE POLICY "Staff can read legal annex attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'legal_annex_attachments'
  AND (
    is_coordinator_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM legal_annexes la
      JOIN user_roles ur ON ur.user_id = auth.uid()
      JOIN agenda_servicos a
        ON a.aluno_id = la.aluno_id
       AND a.profissional_id = auth.uid()
      WHERE la.attachment_url IS NOT NULL
        AND (
          la.attachment_url = objects.name
          OR la.attachment_url LIKE ('%/' || objects.name)
        )
        AND ur.role IN ('professor'::app_role, 'nutricionista'::app_role, 'fisioterapeuta'::app_role)
    )
  )
);

-- 3) cartoes_salvos: lock UPDATE to admin-only with ownership check going forward
CREATE POLICY "cartoes_update_admin_only"
ON public.cartoes_salvos
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (is_admin_role() AND aluno_id IS NOT NULL)
WITH CHECK (is_admin_role() AND aluno_id IS NOT NULL);
