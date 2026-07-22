CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tipo text;
  _tipo_l text;
  _nivel public.clube_nivel_membro;
BEGIN
  SELECT tipo INTO _tipo
  FROM public.planos
  WHERE aluno_id = _aluno_id AND ativo = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF _tipo IS NULL THEN
    RETURN jsonb_build_object('nivel', 'bronze', 'status', 'ativo');
  END IF;

  _tipo_l := lower(_tipo);

  IF _tipo_l LIKE '%wellhub%' OR _tipo_l LIKE '%gympass%'
     OR _tipo_l LIKE '%total pass%' OR _tipo_l LIKE '%totalpass%' THEN
    RETURN jsonb_build_object('nivel', 'bronze', 'status', 'ativo');
  END IF;

  _nivel := CASE
    WHEN _tipo_l LIKE '%max%'   THEN 'platina'::public.clube_nivel_membro
    WHEN _tipo_l LIKE '%pro%'   THEN 'diamante'::public.clube_nivel_membro
    WHEN _tipo_l LIKE '%power%' THEN 'ouro'::public.clube_nivel_membro
    ELSE 'prata'::public.clube_nivel_membro
  END;

  RETURN jsonb_build_object('nivel', _nivel, 'status', 'ativo');
END
$$;