-- 1) Recria o grupo Liberação Miofascial com as subcategorias originais
INSERT INTO public.exercicio_categorias (grupo, subcategoria, ordem_grupo, ordem_sub)
SELECT 'Liberação Miofascial', s.sub, COALESCE((SELECT MAX(ordem_grupo) FROM public.exercicio_categorias), 0) + 10, s.ord
FROM (VALUES
  ('Pé/Tornozelo', 10),
  ('Perna', 20),
  ('Joelho/Coxa', 30),
  ('Quadril', 40),
  ('Lombar', 50),
  ('Torácica', 60),
  ('Ombro/Escápula', 70),
  ('Cervical', 80),
  ('Cotovelo/Punho', 90)
) AS s(sub, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercicio_categorias c
  WHERE c.grupo = 'Liberação Miofascial' AND c.subcategoria = s.sub
);

-- 2) Reclassifica os exercícios de volta
WITH alvo AS (
  SELECT e.id,
    CASE
      WHEN e.nome ILIKE '%panturrilha%' OR e.nome ILIKE '%tibial%' OR e.nome ILIKE '%aquiles%'
        OR e.nome ILIKE '%fáscia plantar%' OR e.nome ILIKE '%fascia plantar%' OR e.nome ILIKE '%plantar%'
        OR e.nome ILIKE '%tornozelo%' OR e.nome ILIKE '%pé%' THEN 'Pé/Tornozelo'
      WHEN e.nome ILIKE '%lombar%' THEN 'Lombar'
      WHEN e.nome ILIKE '%torácica%' OR e.nome ILIKE '%toracica%' THEN 'Torácica'
      WHEN e.nome ILIKE '%nuca%' OR e.nome ILIKE '%cervical%' THEN 'Cervical'
      WHEN e.nome ILIKE '%punho%' OR e.nome ILIKE '%antebraço%' OR e.nome ILIKE '%antebraco%'
        OR e.nome ILIKE '%triceps%' OR e.nome ILIKE '%tríceps%' OR e.nome ILIKE '%cotovelo%' THEN 'Cotovelo/Punho'
      WHEN e.nome ILIKE '%trapézio%' OR e.nome ILIKE '%trapezio%' OR e.nome ILIKE '%escapular%'
        OR e.nome ILIKE '%escápula%' OR e.nome ILIKE '%peitoral%' OR e.nome ILIKE '%grande dorsal%'
        OR e.nome ILIKE '%ombro%' OR e.nome ILIKE '%deltoide%' OR e.nome ILIKE '%redondo%'
        OR e.nome ILIKE '%infraespinhal%' OR e.nome ILIKE '%serrátil%' OR e.nome ILIKE '%serratil%' THEN 'Ombro/Escápula'
      WHEN e.nome ILIKE '%glúteo%' OR e.nome ILIKE '%gluteo%' OR e.nome ILIKE '%psoas%'
        OR e.nome ILIKE '%adutor%' OR e.nome ILIKE '%adutores%' OR e.nome ILIKE '%piriforme%'
        OR e.nome ILIKE '%quadril%' OR e.nome ILIKE '%tfl%' THEN 'Quadril'
      WHEN e.nome ILIKE '%quadriceps%' OR e.nome ILIKE '%quadríceps%' OR e.nome ILIKE '%isquiotibia%'
        OR e.nome ILIKE '%coxa%' OR e.nome ILIKE '%joelho%' OR e.nome ILIKE '%it band%'
        OR e.nome ILIKE '%banda iliotibial%' THEN 'Joelho/Coxa'
      ELSE 'Perna'
    END AS sub
  FROM public.exercicios_personalizados e
  WHERE e.grupos @> '[{"grupo":"Preparação Movimento","subcategoria":"Liberação miofascial"}]'::jsonb
)
UPDATE public.exercicios_personalizados e
SET grupos = (
  SELECT COALESCE(jsonb_agg(DISTINCT g), '[]'::jsonb)
  FROM (
    SELECT CASE
      WHEN el->>'grupo' = 'Preparação Movimento' AND el->>'subcategoria' = 'Liberação miofascial'
        THEN jsonb_build_object('grupo', 'Liberação Miofascial', 'subcategoria', a.sub)
      ELSE el
    END AS g
    FROM jsonb_array_elements(e.grupos) el
  ) t
),
updated_at = now()
FROM alvo a
WHERE a.id = e.id;

-- 3) Remove a subcategoria agora vazia
DELETE FROM public.exercicio_categorias
WHERE grupo = 'Preparação Movimento' AND subcategoria = 'Liberação miofascial'
  AND NOT EXISTS (
    SELECT 1 FROM public.exercicios_personalizados e
    WHERE e.grupos @> '[{"grupo":"Preparação Movimento","subcategoria":"Liberação miofascial"}]'::jsonb
  );