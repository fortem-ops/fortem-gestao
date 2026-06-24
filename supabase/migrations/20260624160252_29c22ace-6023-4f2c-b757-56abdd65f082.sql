CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_cadastros(termo text)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  status text,
  current_pipeline_stage_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT a.id, a.nome, a.telefone, a.status::text, a.current_pipeline_stage_id
  FROM public.alunos a
  WHERE public.unaccent(lower(a.nome)) ILIKE public.unaccent(lower('%' || termo || '%'))
  ORDER BY a.nome
  LIMIT 40;
$$;

GRANT EXECUTE ON FUNCTION public.search_cadastros(text) TO authenticated;