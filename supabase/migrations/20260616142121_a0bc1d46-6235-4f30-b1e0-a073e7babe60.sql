
-- Tighten INSERT policies to staff-only on tables that previously allowed any authenticated user

-- consumo_servicos
DROP POLICY IF EXISTS "Authenticated users can insert consumo" ON public.consumo_servicos;
CREATE POLICY "Staff can insert consumo"
ON public.consumo_servicos
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND (auth.uid() = registrado_por OR public.is_coordinator_or_admin(auth.uid())));

-- historico_profissional
DROP POLICY IF EXISTS "Authenticated users can insert historico" ON public.historico_profissional;
CREATE POLICY "Staff can insert historico"
ON public.historico_profissional
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = autor_id);

-- notificacoes
DROP POLICY IF EXISTS "Authenticated can create notificacoes" ON public.notificacoes;
CREATE POLICY "Staff can create notificacoes"
ON public.notificacoes
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- pipeline_movements
DROP POLICY IF EXISTS "Authenticated can insert movements" ON public.pipeline_movements;
CREATE POLICY "Staff can insert movements"
ON public.pipeline_movements
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND ((moved_by_user_id IS NULL) OR (moved_by_user_id = auth.uid()) OR public.is_coordinator_or_admin(auth.uid())));

-- user_roles: prevent privilege escalation via self-insert/update/delete
-- The existing permissive "Admins can manage roles" (FOR ALL) policy keeps full admin access.
-- Add a RESTRICTIVE policy so writes are only ever allowed when the caller is an admin.
DROP POLICY IF EXISTS "Only admins may write user_roles" ON public.user_roles;
CREATE POLICY "Only admins may write user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
