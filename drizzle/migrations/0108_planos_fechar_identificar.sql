REVOKE EXECUTE ON FUNCTION public.fn_planos_identificar(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_planos_identificar_telefone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_planos_identificar(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_planos_identificar_telefone(text) TO service_role;
COMMENT ON FUNCTION public.fn_planos_identificar(jsonb) IS 'DEPRECATED: substituída pelo cadastro único (planos-codigo)';
COMMENT ON FUNCTION public.fn_planos_identificar_telefone(text) IS 'DEPRECATED: substituída pelo cadastro único (planos-codigo)';