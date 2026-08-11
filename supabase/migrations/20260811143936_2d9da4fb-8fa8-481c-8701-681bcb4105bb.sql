GRANT SELECT ON public.planos_catalogo TO anon;

CREATE POLICY "catalogo_planos_public_corrida_read"
ON public.planos_catalogo
FOR SELECT
TO anon
USING (atividade = 'corrida' AND COALESCE(ativo, true) = true);