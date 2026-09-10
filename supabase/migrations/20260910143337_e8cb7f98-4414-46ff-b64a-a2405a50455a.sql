REVOKE EXECUTE ON FUNCTION public.fn_estoque_movimentar(uuid, text, integer, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_estoque_log_automatico() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estoque_movimentar(uuid, text, integer, text, uuid) TO authenticated;