CREATE OR REPLACE FUNCTION public.fn_plano_principal_ativo(p_aluno_id uuid)
RETURNS public.planos
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM public.planos
  WHERE aluno_id = p_aluno_id AND ativo = true AND atividade = 'treinamento_funcional'
  ORDER BY
    (
      data_fim IS NULL
      OR data_fim >= CURRENT_DATE
      OR COALESCE(renovacao_automatica, false)
    ) DESC,
    created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_plano_principal_ativo(uuid) TO authenticated, service_role;