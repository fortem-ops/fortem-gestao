ALTER TABLE public.banco_treinos_escolhas
  ALTER COLUMN exercicio_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS categoria_override text,
  ADD COLUMN IF NOT EXISTS series_override integer,
  ADD COLUMN IF NOT EXISTS repeticoes_override text,
  ADD COLUMN IF NOT EXISTS dias_override text[];