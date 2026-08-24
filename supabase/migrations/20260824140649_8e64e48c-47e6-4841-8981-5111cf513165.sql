REVOKE ALL ON FUNCTION public.fn_creditos_debitar_por_consumo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_creditos_estornar_por_consumo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_creditos_on_plano_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_creditos_debitar_por_consumo() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_creditos_estornar_por_consumo() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_sync_creditos_on_plano_change() TO service_role;