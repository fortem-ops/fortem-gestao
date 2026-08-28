CREATE OR REPLACE FUNCTION public.fn_promover_sub_para_categoria(
  p_grupo_origem text, p_categoria_origem text, p_sub text, p_grupo_destino text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_ordem_grupo integer;
  v_max_cat integer;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_grupo_origem IS NULL OR p_categoria_origem IS NULL OR p_sub IS NULL OR p_grupo_destino IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;
  IF p_grupo_destino = p_grupo_origem AND p_categoria_origem = p_sub THEN
    RAISE EXCEPTION 'Origem e destino são iguais';
  END IF;

  SELECT MIN(ordem_grupo) INTO v_ordem_grupo
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;
  IF v_ordem_grupo IS NULL THEN
    SELECT COALESCE(MAX(ordem_grupo), 0) + 10 INTO v_ordem_grupo FROM public.exercicio_categorias;
  END IF;

  SELECT COALESCE(MAX(ordem_categoria), 0) + 10 INTO v_max_cat
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;

  INSERT INTO public.exercicio_categorias
    (grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub)
  VALUES
    (p_grupo_destino, p_sub, p_sub, v_ordem_grupo, v_max_cat, 10)
  ON CONFLICT (grupo, categoria, subcategoria) DO NOTHING;

  WITH alvo AS (
    SELECT e.id, e.grupos
      FROM public.exercicios_personalizados e
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(e.grupos) g
        WHERE g->>'grupo' = p_grupo_origem
          AND COALESCE(NULLIF(g->>'categoria', ''), g->>'grupo') = p_categoria_origem
          AND COALESCE(g->>'subcategoria', '') = p_sub
     )
  ), novo AS (
    SELECT a.id,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
          FROM (
            SELECT CASE WHEN g->>'grupo' = p_grupo_origem
                         AND COALESCE(NULLIF(g->>'categoria', ''), g->>'grupo') = p_categoria_origem
                         AND COALESCE(g->>'subcategoria', '') = p_sub
              THEN jsonb_build_object('grupo', p_grupo_destino, 'categoria', p_sub, 'subcategoria', p_sub)
              ELSE g END AS item
              FROM jsonb_array_elements(a.grupos) g
          ) s
      ) AS grupos_novos
    FROM alvo a
  )
  UPDATE public.exercicios_personalizados e
     SET grupos = n.grupos_novos, updated_at = now()
    FROM novo n
   WHERE e.id = n.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.exercicio_categorias
   WHERE grupo = p_grupo_origem AND categoria = p_categoria_origem AND subcategoria = p_sub;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_promover_sub_para_categoria(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_promover_sub_para_categoria(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_promover_categoria_para_grupo(
  p_grupo_origem text, p_categoria text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_ordem_grupo integer;
  r RECORD;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_grupo_origem IS NULL OR p_categoria IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;
  IF p_grupo_origem = p_categoria THEN
    RAISE EXCEPTION 'A categoria já corresponde ao grupo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.exercicio_categorias WHERE grupo = p_categoria) THEN
    RAISE EXCEPTION 'Já existe um grupo com esse nome';
  END IF;

  SELECT COALESCE(MAX(ordem_grupo), 0) + 10 INTO v_ordem_grupo FROM public.exercicio_categorias;

  FOR r IN
    SELECT subcategoria, ordem_sub
      FROM public.exercicio_categorias
     WHERE grupo = p_grupo_origem AND categoria = p_categoria
     ORDER BY ordem_sub
  LOOP
    INSERT INTO public.exercicio_categorias
      (grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub)
    VALUES
      (p_categoria, p_categoria, r.subcategoria, v_ordem_grupo, 10, r.ordem_sub)
    ON CONFLICT (grupo, categoria, subcategoria) DO NOTHING;
  END LOOP;

  WITH alvo AS (
    SELECT e.id, e.grupos
      FROM public.exercicios_personalizados e
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(e.grupos) g
        WHERE g->>'grupo' = p_grupo_origem
          AND COALESCE(NULLIF(g->>'categoria', ''), g->>'grupo') = p_categoria
     )
  ), novo AS (
    SELECT a.id,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
          FROM (
            SELECT CASE WHEN g->>'grupo' = p_grupo_origem
                         AND COALESCE(NULLIF(g->>'categoria', ''), g->>'grupo') = p_categoria
              THEN jsonb_build_object('grupo', p_categoria, 'categoria', p_categoria,
                                      'subcategoria', COALESCE(g->>'subcategoria', ''))
              ELSE g END AS item
              FROM jsonb_array_elements(a.grupos) g
          ) s
      ) AS grupos_novos
    FROM alvo a
  )
  UPDATE public.exercicios_personalizados e
     SET grupos = n.grupos_novos, updated_at = now()
    FROM novo n
   WHERE e.id = n.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.exercicio_categorias
   WHERE grupo = p_grupo_origem AND categoria = p_categoria;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_promover_categoria_para_grupo(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_promover_categoria_para_grupo(text, text) TO authenticated;