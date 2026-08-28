CREATE OR REPLACE FUNCTION public.fn_migrar_exercicio_categoria(
  p_grupo_origem text,
  p_sub_origem text,
  p_grupo_destino text,
  p_sub_destino text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_grupo_origem IS NULL OR p_grupo_destino IS NULL OR p_sub_destino IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  WITH alvo AS (
    SELECT e.id, e.grupos
    FROM public.exercicios_personalizados e
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(e.grupos) g
      WHERE g->>'grupo' = p_grupo_origem
        AND (p_sub_origem IS NULL OR g->>'subcategoria' = p_sub_origem)
    )
  ), novo AS (
    SELECT a.id,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
        FROM (
          SELECT CASE
            WHEN g->>'grupo' = p_grupo_origem
                 AND (p_sub_origem IS NULL OR g->>'subcategoria' = p_sub_origem)
            THEN jsonb_build_object('grupo', p_grupo_destino, 'subcategoria', p_sub_destino)
            ELSE g
          END AS item
          FROM jsonb_array_elements(a.grupos) g
        ) s
      ) AS grupos_novos
    FROM alvo a
  )
  UPDATE public.exercicios_personalizados e
  SET grupos = n.grupos_novos
  FROM novo n
  WHERE e.id = n.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_migrar_exercicio_categoria(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_migrar_exercicio_categoria(text, text, text, text) TO authenticated;