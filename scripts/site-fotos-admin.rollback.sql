-- Rollback: restaura a checagem anterior (por profiles.id) de fn_site_fotos_admin.
CREATE OR REPLACE FUNCTION public.fn_site_fotos_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo IS TRUE)
$$;
