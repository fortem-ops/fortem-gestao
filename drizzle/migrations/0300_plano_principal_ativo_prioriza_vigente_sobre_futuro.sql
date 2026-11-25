CREATE OR REPLACE FUNCTION public.fn_plano_principal_ativo(p_aluno_id uuid)
 RETURNS planos
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.planos p
  WHERE p.aluno_id = p_aluno_id
    AND p.ativo = true
  ORDER BY
    CASE
      WHEN coalesce(p.atividade, '') = 'treinamento_funcional' THEN 0
      WHEN coalesce(p.atividade, '') = 'corrida' THEN 2
      WHEN lower(coalesce(p.tipo, '')) ~ '(^|[^a-z])(start\+?|power|pro|max|vip|gympass|wellhub|total\s*pass|totalpass)([^a-z]|$)' THEN 0
      ELSE 1
    END ASC,
    (
      p.data_fim IS NULL
      OR p.data_fim >= CURRENT_DATE
      OR COALESCE(p.renovacao_automatica, false)
    ) DESC,
    (
      p.data_inicio IS NULL
      OR p.data_inicio <= CURRENT_DATE
    ) DESC,
    p.created_at DESC
  LIMIT 1;
$function$;