-- Rollback: recriar a policy apenas com a condição n.criado_por = auth.uid().
DROP POLICY IF EXISTS "Authenticated upload notif anexos" ON storage.objects;
CREATE POLICY "Authenticated upload notif anexos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'notificacao-anexos'
  AND array_length(storage.foldername(name), 1) = 1
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    EXISTS (SELECT 1 FROM public.notificacoes n
            WHERE n.id = ((storage.foldername(objects.name))[1])::uuid AND n.criado_por = auth.uid())
    OR EXISTS (SELECT 1 FROM public.notificacao_destinatarios nd
            WHERE nd.notificacao_id = ((storage.foldername(objects.name))[1])::uuid AND nd.usuario_id = auth.uid())
  )
);