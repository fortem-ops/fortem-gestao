-- 1) Remove escrita anônima irrestrita em pedidos/pedido_itens.
-- A criação de pedidos passa exclusivamente pela RPC SECURITY DEFINER fn_loja_criar_pedido
-- (chamada pelas edge functions), portanto nenhum insert direto é necessário.
DROP POLICY IF EXISTS pedidos_public_insert ON public.pedidos;
DROP POLICY IF EXISTS pedido_itens_public_insert ON public.pedido_itens;

REVOKE INSERT, UPDATE, DELETE ON public.pedidos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pedido_itens FROM anon;
REVOKE SELECT ON public.pedidos FROM anon;
REVOKE SELECT ON public.pedido_itens FROM anon;
GRANT ALL ON public.pedidos TO service_role;
GRANT ALL ON public.pedido_itens TO service_role;

-- 2) Webhook de pagamento: ingestão somente via service_role (edge function rede-webhook).
REVOKE INSERT, UPDATE, DELETE ON public.webhook_events_rede FROM anon, authenticated;
GRANT ALL ON public.webhook_events_rede TO service_role;

DROP POLICY IF EXISTS webhook_events_rede_service_insert ON public.webhook_events_rede;
CREATE POLICY webhook_events_rede_service_insert
  ON public.webhook_events_rede
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3) Anexos de notificação: exigir caminho no formato <uuid>/<arquivo>,
-- impedindo forja de pastas e travessia de caminho.
DROP POLICY IF EXISTS "Authenticated upload notif anexos" ON storage.objects;
CREATE POLICY "Authenticated upload notif anexos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'notificacao-anexos'
    AND array_length(storage.foldername(name), 1) = 1
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.id = ((storage.foldername(name))[1])::uuid
        AND n.criado_por = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Recipients or author read notif anexos" ON storage.objects;
CREATE POLICY "Recipients or author read notif anexos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'notificacao-anexos'
    AND array_length(storage.foldername(name), 1) = 1
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      EXISTS (
        SELECT 1 FROM public.notificacao_destinatarios nd
        WHERE nd.notificacao_id = ((storage.foldername(name))[1])::uuid
          AND nd.usuario_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.notificacoes n
        WHERE n.id = ((storage.foldername(name))[1])::uuid
          AND n.criado_por = auth.uid()
      )
    )
  );