CREATE OR REPLACE FUNCTION public.fn_mover_grupo_para_grupo(p_grupo_origem text, p_grupo_destino text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_grupo_origem IS NULL OR p_grupo_destino IS NULL OR p_grupo_origem = p_grupo_destino THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  v_count := public.fn_migrar_grupo_preservando_subs(p_grupo_origem, p_grupo_destino);

  DELETE FROM public.exercicio_categorias WHERE grupo = p_grupo_origem;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_mover_grupo_para_grupo(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_mover_grupo_para_grupo(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_mover_sub_para_grupo(p_grupo_origem text, p_sub text, p_grupo_destino text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_ordem_grupo integer;
  v_max_sub integer;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_grupo_origem IS NULL OR p_sub IS NULL OR p_grupo_destino IS NULL OR p_grupo_origem = p_grupo_destino THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  SELECT MIN(ordem_grupo) INTO v_ordem_grupo
  FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;

  IF v_ordem_grupo IS NULL THEN
    SELECT COALESCE(MAX(ordem_grupo), 0) + 10 INTO v_ordem_grupo FROM public.exercicio_categorias;
  END IF;

  SELECT COALESCE(MAX(ordem_sub), 0) INTO v_max_sub
  FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;

  IF NOT EXISTS (
    SELECT 1 FROM public.exercicio_categorias
    WHERE grupo = p_grupo_destino AND subcategoria = p_sub
  ) THEN
    INSERT INTO public.exercicio_categorias (grupo, subcategoria, ordem_grupo, ordem_sub)
    VALUES (p_grupo_destino, p_sub, v_ordem_grupo, v_max_sub + 10);
  END IF;

  WITH alvo AS (
    SELECT e.id, e.grupos
    FROM public.exercicios_personalizados e
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(e.grupos) g
      WHERE g->>'grupo' = p_grupo_origem AND g->>'subcategoria' = p_sub
    )
  ), novo AS (
    SELECT a.id,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
        FROM (
          SELECT CASE
            WHEN g->>'grupo' = p_grupo_origem AND g->>'subcategoria' = p_sub
            THEN jsonb_build_object('grupo', p_grupo_destino, 'subcategoria', p_sub)
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

  DELETE FROM public.exercicio_categorias
  WHERE grupo = p_grupo_origem AND subcategoria = p_sub;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_mover_sub_para_grupo(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_mover_sub_para_grupo(text, text, text) TO authenticated;