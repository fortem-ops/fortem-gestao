-- Dentro de funções SECURITY DEFINER current_user é o dono; a checagem deve usar só o papel do token.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_eh_service() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(auth.jwt()->>'role','') = 'service_role'
$$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_eh_service() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_eh_service() TO authenticated, service_role;
