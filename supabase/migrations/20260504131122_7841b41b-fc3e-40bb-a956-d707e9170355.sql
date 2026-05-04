ALTER TABLE public.exercicios_personalizados ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_exercicios_personalizados_ordem ON public.exercicios_personalizados(ordem);

-- Backfill ordem with sequential values based on nome
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY nome) * 10 AS rn
  FROM public.exercicios_personalizados
)
UPDATE public.exercicios_personalizados e
SET ordem = ranked.rn
FROM ranked
WHERE e.id = ranked.id AND e.ordem = 0;