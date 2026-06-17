
-- 1) Remove anonymous INSERT on legal_annex_attachments bucket
DROP POLICY IF EXISTS "Public can upload legal annex attestados" ON storage.objects;

-- 2) Tighten treinos INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert treinos" ON public.treinos;
CREATE POLICY "Staff or self can insert treinos" ON public.treinos
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = autor_id
    AND (
      public.is_staff(auth.uid())
      OR aluno_id = public.fn_current_aluno_id()
    )
  );

-- 3) Tighten uploads INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can insert uploads" ON public.uploads;
CREATE POLICY "Staff or self can insert uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = autor_id
    AND (
      public.is_staff(auth.uid())
      OR aluno_id = public.fn_current_aluno_id()
    )
  );
