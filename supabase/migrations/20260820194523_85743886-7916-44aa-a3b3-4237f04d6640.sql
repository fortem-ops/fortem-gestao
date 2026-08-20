REVOKE EXECUTE ON FUNCTION public.fn_comissao_af_ativa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_comissao_af_ativa() TO service_role;