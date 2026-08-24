DROP POLICY IF EXISTS notif_dest_staff_insert ON public.notificacao_destinatarios;

CREATE POLICY notif_dest_staff_insert
ON public.notificacao_destinatarios
FOR INSERT
TO authenticated
WITH CHECK (
  is_professor_staff()
  AND notificacao_id IN (
    SELECT n.id FROM public.notificacoes n WHERE n.criado_por = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = notificacao_destinatarios.usuario_id
      AND ur.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  )
);