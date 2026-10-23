-- E5b-C PROPOSTA — NÃO APLICADA. Fecha a versão de 5 argumentos (sem checagem de quem chama) a todos menos service_role.
REVOKE EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, uuid, timestamptz, uuid, text) TO service_role;
-- Esperado depois: proacl = {postgres=X/postgres,service_role=X/postgres}. Corpo da função não muda.
