CREATE OR REPLACE FUNCTION public.fn_tarefa_tecnica(_tipo text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(_tipo IN ('relatorio_tecnico_forca','relatorio_tecnico_corrida','relatorio_reabilitacao','relatorio_experimental','reavaliacao_funcional','avaliacao_funcional_agendada','atualizar_treino','treino_onda_concluida'),false);
$$;
REVOKE ALL ON FUNCTION public.fn_tarefa_tecnica(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_tarefa_tecnica(text) TO authenticated,service_role;