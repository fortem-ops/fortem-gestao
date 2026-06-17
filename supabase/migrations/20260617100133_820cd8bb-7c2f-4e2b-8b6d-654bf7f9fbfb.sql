-- 1) legal_annexes: remove open INSERT policy; inserts happen via service role only
DROP POLICY IF EXISTS "Authenticated can submit legal annex" ON public.legal_annexes;

-- 2) tarefas: require staff role to insert
DROP POLICY IF EXISTS "Authenticated users can insert tarefas" ON public.tarefas;
CREATE POLICY "Staff can insert tarefas"
ON public.tarefas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = criado_por_id
  AND public.is_staff(auth.uid())
);

-- 3) storage.objects: allow students to read files under their own aluno-files folder
DROP POLICY IF EXISTS "Aluno can view own aluno files" ON storage.objects;
CREATE POLICY "Aluno can view own aluno files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'aluno-files'
  AND public.fn_current_aluno_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.fn_current_aluno_id()::text
);