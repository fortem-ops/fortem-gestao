ALTER TABLE public.produtos_catalogo ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, (row_number() OVER (ORDER BY created_at DESC)) * 10 AS pos
  FROM public.produtos_catalogo
)
UPDATE public.produtos_catalogo p
SET ordem = r.pos
FROM ranked r
WHERE p.id = r.id;

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_ordem ON public.produtos_catalogo (ordem);