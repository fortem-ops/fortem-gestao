CREATE OR REPLACE FUNCTION public.festa_acompanhantes_validos(valor jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(valor) = 'array'
    AND jsonb_array_length(valor) <= 3
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(valor) AS item
      WHERE jsonb_typeof(item) <> 'string'
         OR char_length(btrim(item #>> '{}')) NOT BETWEEN 2 AND 120
    );
$$;