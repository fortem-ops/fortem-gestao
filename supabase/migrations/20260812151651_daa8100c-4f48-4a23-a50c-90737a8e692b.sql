-- avaliacoes: consolidate to a single canonical policy set
DROP POLICY IF EXISTS "Staff or own aluno can view avaliacoes" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_self_select" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_staff_select" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_staff_all" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_staff_insert" ON public.avaliacoes;
DROP POLICY IF EXISTS "Authenticated users can insert avaliacoes" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_staff_update" ON public.avaliacoes;
DROP POLICY IF EXISTS "Author or coord/admin can update avaliacoes" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_admin_delete" ON public.avaliacoes;
DROP POLICY IF EXISTS "Coord/Admin can delete avaliacoes" ON public.avaliacoes;

CREATE POLICY "avaliacoes_select" ON public.avaliacoes
FOR SELECT TO authenticated
USING (is_staff(auth.uid()) OR aluno_id = fn_current_aluno_id());

CREATE POLICY "avaliacoes_insert" ON public.avaliacoes
FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "avaliacoes_update" ON public.avaliacoes
FOR UPDATE TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "avaliacoes_delete" ON public.avaliacoes
FOR DELETE TO authenticated
USING (is_coordinator_or_admin(auth.uid()) OR is_admin_role());

-- notificacao_destinatarios: validate recipient against user_roles instead of profiles
DROP POLICY IF EXISTS "notif_dest_staff_insert" ON public.notificacao_destinatarios;

CREATE POLICY "notif_dest_staff_insert" ON public.notificacao_destinatarios
FOR INSERT TO authenticated
WITH CHECK (
  is_professor_staff()
  AND notificacao_id IN (SELECT n.id FROM public.notificacoes n WHERE n.criado_por = auth.uid())
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = notificacao_destinatarios.usuario_id)
);