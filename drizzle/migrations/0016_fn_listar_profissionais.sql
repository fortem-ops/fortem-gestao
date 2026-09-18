CREATE OR REPLACE FUNCTION public.fn_listar_profissionais()
RETURNS TABLE (user_id uuid, full_name text, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.user_id) p.user_id, p.full_name, ur.role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role IN ('professor','nutricionista','fisioterapeuta','coordenador','admin')
  ORDER BY p.user_id, ur.role;
$$;

GRANT EXECUTE ON FUNCTION public.fn_listar_profissionais() TO authenticated;