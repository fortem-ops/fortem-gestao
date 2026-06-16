DROP POLICY IF EXISTS "Only admins may write user_roles" ON public.user_roles;

CREATE POLICY "Only admins may insert user_roles"
ON public.user_roles AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins may update user_roles"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins may delete user_roles"
ON public.user_roles AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));