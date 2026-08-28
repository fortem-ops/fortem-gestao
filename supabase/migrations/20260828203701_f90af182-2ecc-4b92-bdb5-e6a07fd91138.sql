-- =========================================================
-- 1. Schema: novo nível "categoria"
-- =========================================================
ALTER TABLE public.exercicio_categorias
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS ordem_categoria integer NOT NULL DEFAULT 0;

UPDATE public.exercicio_categorias SET categoria = grupo WHERE categoria IS NULL;
UPDATE public.exercicio_categorias SET ordem_categoria = 10 WHERE ordem_categoria = 0;

ALTER TABLE public.exercicio_categorias ALTER COLUMN categoria SET NOT NULL;

ALTER TABLE public.exercicio_categorias DROP CONSTRAINT IF EXISTS exercicio_categorias_unique;
ALTER TABLE public.exercicio_categorias
  ADD CONSTRAINT exercicio_categorias_unique UNIQUE (grupo, categoria, subcategoria);

-- =========================================================
-- 2. Backfill do jsonb de exercícios
-- =========================================================
UPDATE public.exercicios_personalizados e
SET grupos = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN COALESCE(g->>'categoria', '') <> '' THEN g
      ELSE jsonb_set(g, '{categoria}', to_jsonb(COALESCE(g->>'grupo', '')))
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(e.grupos) g
)
WHERE jsonb_typeof(e.grupos) = 'array'
  AND jsonb_array_length(e.grupos) > 0;

-- =========================================================
-- 3. Remove funções antigas de 2 níveis
-- =========================================================
DROP FUNCTION IF EXISTS public.fn_mover_grupo_para_grupo(text, text);
DROP FUNCTION IF EXISTS public.fn_mover_sub_para_grupo(text, text, text);
DROP FUNCTION IF EXISTS public.fn_migrar_grupo_preservando_subs(text, text);
DROP FUNCTION IF EXISTS public.fn_migrar_exercicio_categoria(text, text, text, text);
DROP FUNCTION IF EXISTS public.rename_exercicio_categoria(text, text, text, text);

-- =========================================================
-- 4. Renomear (grupo / categoria / subcategoria)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_renomear_nivel_exercicio(
  p_grupo text,
  p_categoria text,
  p_subcategoria text,
  p_novo_nome text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_grupo IS NULL OR COALESCE(p_novo_nome, '') = '' THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  IF p_categoria IS NULL THEN
    UPDATE public.exercicio_categorias
       SET grupo = p_novo_nome,
           categoria = CASE WHEN categoria = p_grupo THEN p_novo_nome ELSE categoria END,
           updated_at = now()
     WHERE grupo = p_grupo;

    UPDATE public.exercicios_personalizados e
       SET grupos = (
             SELECT COALESCE(jsonb_agg(
               CASE WHEN g->>'grupo' = p_grupo
                 THEN jsonb_build_object(
                        'grupo', p_novo_nome,
                        'categoria', CASE WHEN COALESCE(g->>'categoria', g->>'grupo') = p_grupo
                                          THEN p_novo_nome
                                          ELSE COALESCE(g->>'categoria', '') END,
                        'subcategoria', COALESCE(g->>'subcategoria', ''))
                 ELSE g END
             ), '[]'::jsonb)
             FROM jsonb_array_elements(e.grupos) g
           ),
           updated_at = now()
     WHERE e.grupos @> jsonb_build_array(jsonb_build_object('grupo', p_grupo));

  ELSIF p_subcategoria IS NULL THEN
    UPDATE public.exercicio_categorias
       SET categoria = p_novo_nome, updated_at = now()
     WHERE grupo = p_grupo AND categoria = p_categoria;

    UPDATE public.exercicios_personalizados e
       SET grupos = (
             SELECT COALESCE(jsonb_agg(
               CASE WHEN g->>'grupo' = p_grupo AND COALESCE(g->>'categoria', g->>'grupo') = p_categoria
                 THEN jsonb_set(g, '{categoria}', to_jsonb(p_novo_nome))
                 ELSE g END
             ), '[]'::jsonb)
             FROM jsonb_array_elements(e.grupos) g
           ),
           updated_at = now()
     WHERE e.grupos @> jsonb_build_array(jsonb_build_object('grupo', p_grupo));

  ELSE
    UPDATE public.exercicio_categorias
       SET subcategoria = p_novo_nome, updated_at = now()
     WHERE grupo = p_grupo AND categoria = p_categoria AND subcategoria = p_subcategoria;

    UPDATE public.exercicios_personalizados e
       SET grupos = (
             SELECT COALESCE(jsonb_agg(
               CASE WHEN g->>'grupo' = p_grupo
                     AND COALESCE(g->>'categoria', g->>'grupo') = p_categoria
                     AND COALESCE(g->>'subcategoria', '') = p_subcategoria
                 THEN jsonb_set(g, '{subcategoria}', to_jsonb(p_novo_nome))
                 ELSE g END
             ), '[]'::jsonb)
             FROM jsonb_array_elements(e.grupos) g
           ),
           updated_at = now()
     WHERE e.grupos @> jsonb_build_array(jsonb_build_object('grupo', p_grupo));
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_renomear_nivel_exercicio(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_renomear_nivel_exercicio(text, text, text, text) TO authenticated;

-- =========================================================
-- 5. Mover grupo -> vira categoria dentro de outro grupo
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_mover_grupo_como_categoria(
  p_grupo_origem text,
  p_grupo_destino text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_ordem_grupo integer;
  v_max_cat integer;
  r RECORD;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_grupo_origem IS NULL OR p_grupo_destino IS NULL OR p_grupo_origem = p_grupo_destino THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  SELECT MIN(ordem_grupo) INTO v_ordem_grupo
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;
  IF v_ordem_grupo IS NULL THEN
    SELECT COALESCE(MAX(ordem_grupo), 0) + 10 INTO v_ordem_grupo FROM public.exercicio_categorias;
  END IF;

  SELECT COALESCE(MAX(ordem_categoria), 0) INTO v_max_cat
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;

  FOR r IN
    SELECT categoria, subcategoria, ordem_categoria, ordem_sub
      FROM public.exercicio_categorias
     WHERE grupo = p_grupo_origem
     ORDER BY ordem_categoria, ordem_sub
  LOOP
    INSERT INTO public.exercicio_categorias
      (grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub)
    VALUES
      (p_grupo_destino, r.categoria, r.subcategoria, v_ordem_grupo, v_max_cat + r.ordem_categoria, r.ordem_sub)
    ON CONFLICT (grupo, categoria, subcategoria) DO NOTHING;
  END LOOP;

  WITH alvo AS (
    SELECT e.id, e.grupos
      FROM public.exercicios_personalizados e
     WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(e.grupos) g WHERE g->>'grupo' = p_grupo_origem)
  ), novo AS (
    SELECT a.id,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
          FROM (
            SELECT CASE WHEN g->>'grupo' = p_grupo_origem
              THEN jsonb_build_object(
                     'grupo', p_grupo_destino,
                     'categoria', COALESCE(NULLIF(g->>'categoria', ''), p_grupo_origem),
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

  DELETE FROM public.exercicio_categorias WHERE grupo = p_grupo_origem;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_mover_grupo_como_categoria(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mover_grupo_como_categoria(text, text) TO authenticated;

-- =========================================================
-- 6. Mover categoria para outro grupo
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_mover_categoria_para_grupo(
  p_grupo_origem text,
  p_categoria text,
  p_grupo_destino text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_ordem_grupo integer;
  v_max_cat integer;
  r RECORD;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_grupo_origem IS NULL OR p_categoria IS NULL OR p_grupo_destino IS NULL
     OR p_grupo_origem = p_grupo_destino THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  SELECT MIN(ordem_grupo) INTO v_ordem_grupo
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;
  IF v_ordem_grupo IS NULL THEN
    SELECT COALESCE(MAX(ordem_grupo), 0) + 10 INTO v_ordem_grupo FROM public.exercicio_categorias;
  END IF;

  SELECT COALESCE(MAX(ordem_categoria), 0) + 10 INTO v_max_cat
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;

  FOR r IN
    SELECT subcategoria, ordem_sub
      FROM public.exercicio_categorias
     WHERE grupo = p_grupo_origem AND categoria = p_categoria
     ORDER BY ordem_sub
  LOOP
    INSERT INTO public.exercicio_categorias
      (grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub)
    VALUES
      (p_grupo_destino, p_categoria, r.subcategoria, v_ordem_grupo, v_max_cat, r.ordem_sub)
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
              THEN jsonb_build_object(
                     'grupo', p_grupo_destino,
                     'categoria', p_categoria,
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

REVOKE ALL ON FUNCTION public.fn_mover_categoria_para_grupo(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mover_categoria_para_grupo(text, text, text) TO authenticated;

-- =========================================================
-- 7. Mover subcategoria para outra categoria
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_mover_sub_para_categoria(
  p_grupo_origem text,
  p_categoria_origem text,
  p_sub text,
  p_grupo_destino text,
  p_categoria_destino text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_ordem_grupo integer;
  v_ordem_cat integer;
  v_max_sub integer;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_grupo_origem IS NULL OR p_categoria_origem IS NULL OR p_sub IS NULL
     OR p_grupo_destino IS NULL OR p_categoria_destino IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;
  IF p_grupo_origem = p_grupo_destino AND p_categoria_origem = p_categoria_destino THEN
    RAISE EXCEPTION 'Origem e destino são iguais';
  END IF;

  SELECT MIN(ordem_grupo) INTO v_ordem_grupo
    FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;
  IF v_ordem_grupo IS NULL THEN
    SELECT COALESCE(MAX(ordem_grupo), 0) + 10 INTO v_ordem_grupo FROM public.exercicio_categorias;
  END IF;

  SELECT MIN(ordem_categoria) INTO v_ordem_cat
    FROM public.exercicio_categorias
   WHERE grupo = p_grupo_destino AND categoria = p_categoria_destino;
  IF v_ordem_cat IS NULL THEN
    SELECT COALESCE(MAX(ordem_categoria), 0) + 10 INTO v_ordem_cat
      FROM public.exercicio_categorias WHERE grupo = p_grupo_destino;
  END IF;

  SELECT COALESCE(MAX(ordem_sub), 0) + 10 INTO v_max_sub
    FROM public.exercicio_categorias
   WHERE grupo = p_grupo_destino AND categoria = p_categoria_destino;

  INSERT INTO public.exercicio_categorias
    (grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub)
  VALUES
    (p_grupo_destino, p_categoria_destino, p_sub, v_ordem_grupo, v_ordem_cat, v_max_sub)
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
              THEN jsonb_build_object(
                     'grupo', p_grupo_destino,
                     'categoria', p_categoria_destino,
                     'subcategoria', p_sub)
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

REVOKE ALL ON FUNCTION public.fn_mover_sub_para_categoria(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mover_sub_para_categoria(text, text, text, text, text) TO authenticated;

-- =========================================================
-- 8. Migrar exercícios entre níveis (aba Migrar)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_migrar_exercicio_categoria(
  p_grupo_origem text,
  p_categoria_origem text,
  p_sub_origem text,
  p_grupo_destino text,
  p_categoria_destino text,
  p_sub_destino text
)
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
  IF p_grupo_origem IS NULL OR p_grupo_destino IS NULL
     OR p_categoria_destino IS NULL OR p_sub_destino IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;

  INSERT INTO public.exercicio_categorias
    (grupo, categoria, subcategoria, ordem_grupo, ordem_categoria, ordem_sub)
  SELECT p_grupo_destino, p_categoria_destino, p_sub_destino,
         COALESCE((SELECT MIN(ordem_grupo) FROM public.exercicio_categorias WHERE grupo = p_grupo_destino), 10),
         COALESCE((SELECT MIN(ordem_categoria) FROM public.exercicio_categorias WHERE grupo = p_grupo_destino AND categoria = p_categoria_destino), 10),
         COALESCE((SELECT MAX(ordem_sub) + 10 FROM public.exercicio_categorias WHERE grupo = p_grupo_destino AND categoria = p_categoria_destino), 10)
  ON CONFLICT (grupo, categoria, subcategoria) DO NOTHING;

  WITH alvo AS (
    SELECT e.id, e.grupos
      FROM public.exercicios_personalizados e
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(e.grupos) g
        WHERE g->>'grupo' = p_grupo_origem
          AND (p_categoria_origem IS NULL OR COALESCE(NULLIF(g->>'categoria', ''), g->>'grupo') = p_categoria_origem)
          AND (p_sub_origem IS NULL OR COALESCE(g->>'subcategoria', '') = p_sub_origem)
     )
  ), novo AS (
    SELECT a.id,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
          FROM (
            SELECT CASE WHEN g->>'grupo' = p_grupo_origem
                         AND (p_categoria_origem IS NULL OR COALESCE(NULLIF(g->>'categoria', ''), g->>'grupo') = p_categoria_origem)
                         AND (p_sub_origem IS NULL OR COALESCE(g->>'subcategoria', '') = p_sub_origem)
              THEN jsonb_build_object('grupo', p_grupo_destino, 'categoria', p_categoria_destino, 'subcategoria', p_sub_destino)
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
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_migrar_exercicio_categoria(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_migrar_exercicio_categoria(text, text, text, text, text, text) TO authenticated;