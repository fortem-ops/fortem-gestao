
-- 1. Tighten legal_annex_attachments storage INSERT policy: only allow paths under
--    'attestados/' (uploaded from the public flow); signatures go via service role.
DROP POLICY IF EXISTS "Anyone upload legal annex attachments" ON storage.objects;

CREATE POLICY "Public can upload legal annex attestados"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'legal_annex_attachments'
  AND (storage.foldername(name))[1] = 'attestados'
);

-- 2. Allow students to read their own benefit-usage records
CREATE POLICY "Students can view their own uso_beneficios"
ON public.uso_beneficios FOR SELECT
TO authenticated
USING (aluno_id = public.fn_current_aluno_id());
