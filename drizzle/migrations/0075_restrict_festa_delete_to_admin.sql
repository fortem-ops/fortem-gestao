DROP POLICY festa_confirmacoes_staff_delete ON public.festa_confirmacoes;

CREATE POLICY festa_confirmacoes_admin_delete
ON public.festa_confirmacoes
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));