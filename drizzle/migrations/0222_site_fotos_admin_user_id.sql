CREATE OR REPLACE FUNCTION public.fn_site_fotos_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.ativo IS TRUE)
$$;
REVOKE ALL ON FUNCTION public.fn_site_fotos_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_site_fotos_admin() TO authenticated;