CREATE OR REPLACE FUNCTION public.fn_cartoes_cobraveis(p_aluno_id uuid)
RETURNS TABLE (
  id uuid,
  brand text,
  last4 text,
  expiration_month integer,
  expiration_year integer,
  is_default boolean,
  apto boolean,
  motivo_inapto text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.brand::text,
    c.last4::text,
    c.expiration_month::integer,
    c.expiration_year::integer,
    COALESCE(c.is_default, false),
    (
      COALESCE(c.ativo, false)
      AND make_date(c.expiration_year::int, c.expiration_month::int, 1) + interval '1 month' > now()
      AND EXISTS (
        SELECT 1 FROM public.rede_tokenizacoes t
        WHERE t.cartao_salvo_id = c.id AND t.status = 'active'
      )
    ) AS apto,
    CASE
      WHEN NOT COALESCE(c.ativo, false) THEN 'inativo'
      WHEN make_date(c.expiration_year::int, c.expiration_month::int, 1) + interval '1 month' <= now() THEN 'vencido'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.rede_tokenizacoes t
        WHERE t.cartao_salvo_id = c.id AND t.status = 'active'
      ) THEN 'precisa recadastrar'
      ELSE NULL
    END AS motivo_inapto
  FROM public.cartoes_salvos c
  WHERE c.aluno_id = p_aluno_id
  ORDER BY COALESCE(c.is_default, false) DESC, c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cartoes_cobraveis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cartoes_cobraveis(uuid) TO authenticated, service_role;