ALTER TABLE public.mapeamento_beneficiarios_pix ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapeamento_beneficiarios_pix TO authenticated;
GRANT ALL ON public.mapeamento_beneficiarios_pix TO service_role;

CREATE POLICY "mapeamento_pix_admin_select"
ON public.mapeamento_beneficiarios_pix
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "mapeamento_pix_admin_insert"
ON public.mapeamento_beneficiarios_pix
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "mapeamento_pix_admin_update"
ON public.mapeamento_beneficiarios_pix
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "mapeamento_pix_admin_delete"
ON public.mapeamento_beneficiarios_pix
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));