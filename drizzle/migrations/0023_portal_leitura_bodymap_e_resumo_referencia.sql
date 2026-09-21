-- 1) Formas do mapa corporal: leitura liberada para qualquer usuário autenticado.
-- São apenas coordenadas de desenho (sem dado pessoal). Escrita continua restrita.
GRANT SELECT ON public.bodymap_shapes TO authenticated;

CREATE POLICY "Authenticated can read bodymap shapes"
ON public.bodymap_shapes
FOR SELECT
TO authenticated
USING (true);

-- 2) Resumo agregado da base Fortem de mobilidade (nenhuma linha individual sai daqui).
CREATE OR REPLACE FUNCTION public.fn_mobilidade_referencia_resumo()
RETURNS TABLE (metrica text, sexo text, faixa text, n integer, media numeric, desvio numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.metrica,
         m.sexo,
         'todos'::text AS faixa,
         count(*)::int AS n,
         avg(m.valor)::numeric AS media,
         COALESCE(stddev_pop(m.valor), 0)::numeric AS desvio
  FROM public.mobilidade_amostras_fortem m
  WHERE m.valor IS NOT NULL
  GROUP BY m.metrica, m.sexo
  UNION ALL
  SELECT m.metrica,
         m.sexo,
         m.faixa_etaria AS faixa,
         count(*)::int AS n,
         avg(m.valor)::numeric AS media,
         COALESCE(stddev_pop(m.valor), 0)::numeric AS desvio
  FROM public.mobilidade_amostras_fortem m
  WHERE m.valor IS NOT NULL AND m.faixa_etaria IS NOT NULL
  GROUP BY m.metrica, m.sexo, m.faixa_etaria
$$;

REVOKE ALL ON FUNCTION public.fn_mobilidade_referencia_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_mobilidade_referencia_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mobilidade_referencia_resumo() TO service_role;

COMMENT ON FUNCTION public.fn_mobilidade_referencia_resumo() IS
  'Resumo agregado (n, media, desvio) da base Fortem de mobilidade por metrica/sexo/faixa etaria, incluindo o grupo "todos". Usado pelo Portal do Aluno sem expor medidas individuais.';
