
DROP POLICY IF EXISTS "Authenticated can view active partner public fields" ON public.parceiros;

DROP VIEW IF EXISTS public.parceiros_publico;

CREATE VIEW public.parceiros_publico AS
SELECT
  id, nome, categoria, descricao, logo_url, endereco,
  latitude, longitude, modo_validacao, pontuacao_engajamento, ativo
FROM public.parceiros
WHERE ativo = true;

-- View runs with definer rights (owner = postgres) so the safe columns
-- are accessible to non-staff authenticated users without exposing the
-- sensitive columns guarded by RLS on the base table.
GRANT SELECT ON public.parceiros_publico TO authenticated;
