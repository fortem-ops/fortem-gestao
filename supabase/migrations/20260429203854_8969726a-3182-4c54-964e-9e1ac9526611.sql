-- Normaliza subcategorias com erro de digitação no JSONB de exercicios_personalizados
UPDATE public.exercicios_personalizados
SET grupos = (
  SELECT jsonb_agg(
    CASE
      WHEN g->>'subcategoria' = 'Plioetria'    THEN jsonb_set(g, '{subcategoria}', '"Pliometria"'::jsonb)
      WHEN g->>'subcategoria' = 'Isoiniercial' THEN jsonb_set(g, '{subcategoria}', '"Isoinercial"'::jsonb)
      ELSE g
    END
  )
  FROM jsonb_array_elements(grupos) g
)
WHERE grupos::text ~ '(Plioetria|Isoiniercial)';

-- Atualiza overrides salvos
UPDATE public.banco_treinos_escolhas
SET subcategoria_override = CASE subcategoria_override
  WHEN 'Plioetria' THEN 'Pliometria'
  WHEN 'Isoiniercial' THEN 'Isoinercial'
END
WHERE subcategoria_override IN ('Plioetria','Isoiniercial');