CREATE POLICY "Loja produtos imagens leitura publica"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'loja-produtos');

CREATE POLICY "Loja produtos imagens envio admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'loja-produtos'
  AND public.is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "Loja produtos imagens atualizacao admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'loja-produtos'
  AND public.is_coordinator_or_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'loja-produtos'
  AND public.is_coordinator_or_admin(auth.uid())
);

CREATE POLICY "Loja produtos imagens exclusao admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'loja-produtos'
  AND public.is_coordinator_or_admin(auth.uid())
);