-- E5b-C ROLLBACK: devolve o EXECUTE exatamente como antes.
GRANT EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, uuid, timestamptz, uuid, text) TO PUBLIC, anon, authenticated, service_role;
