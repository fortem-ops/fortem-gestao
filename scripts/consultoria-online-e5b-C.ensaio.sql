-- E5b-C ENSAIO — NÃO EXECUTADO. Transação desfeita.
-- 1) busca de chamadores (feita em 23/10/2026, ver abaixo); 2) aplicar REVOKE; 3) conferir proacl e que
--    has_function_privilege('anon'/'authenticated', ...) = false e 'service_role' = true;
--    4) conferir que fn_agendar_servico(uuid,date) (app) e fn_agendar_servico_equipe mantêm EXECUTE de authenticated.
DO $c$
DECLARE f constant regprocedure := 'public.fn_agendar_servico(uuid,uuid,timestamptz,uuid,text)'; out jsonb;
BEGIN
  REVOKE EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.fn_agendar_servico(uuid, uuid, timestamptz, uuid, text) TO service_role;
  out := jsonb_build_object('acl', (SELECT proacl::text FROM pg_proc WHERE oid=f),
    'anon', has_function_privilege('anon', f, 'EXECUTE'), 'authenticated', has_function_privilege('authenticated', f, 'EXECUTE'),
    'service_role', has_function_privilege('service_role', f, 'EXECUTE'),
    'app_2args_auth', has_function_privilege('authenticated', 'public.fn_agendar_servico(uuid,date)'::regprocedure, 'EXECUTE'),
    'equipe_auth', has_function_privilege('authenticated', 'public.fn_agendar_servico_equipe(uuid,uuid,date)'::regprocedure, 'EXECUTE'));
  RAISE EXCEPTION 'E5BC_RESULTADO %', out;
END $c$;
-- Busca de chamadores (23/10/2026):
--   src/ e supabase/functions: única chamada é PortalAgenda.tsx com {p_agenda_servico_id, p_data} → resolve para a versão de 2 argumentos.
--   funções do banco (prosrc ~ 'fn_agendar_servico('): nenhuma; views: nenhuma; triggers: nenhum; cron.job: nenhum.
--   uso registrado: pg_stat_user_functions vazio (track_functions = none, sem contagem disponível);
--   logs de API recentes: nenhuma chamada a fn_agendar_servico no período retido.
