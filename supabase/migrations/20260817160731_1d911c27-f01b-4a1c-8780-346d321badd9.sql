CREATE OR REPLACE FUNCTION public.fn_get_or_create_ficha_equipe()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _nome text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _uid
      AND ur.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe';
  END IF;

  SELECT id INTO _id FROM public.alunos WHERE user_id = _uid AND is_equipe LIMIT 1;
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  SELECT COALESCE(NULLIF(p.full_name, ''), 'Equipe') INTO _nome
  FROM public.profiles p WHERE p.user_id = _uid LIMIT 1;

  INSERT INTO public.alunos (nome, user_id, status, is_equipe)
  VALUES (COALESCE(_nome, 'Equipe'), _uid, 'ativo', true)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_or_create_ficha_equipe_de(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _id uuid;
  _nome text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _caller
      AND ur.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  ) THEN
    RAISE EXCEPTION 'Usuário alvo não é da equipe';
  END IF;

  SELECT id INTO _id FROM public.alunos WHERE user_id = _user_id AND is_equipe LIMIT 1;
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  SELECT COALESCE(NULLIF(p.full_name, ''), 'Equipe') INTO _nome
  FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1;

  INSERT INTO public.alunos (nome, user_id, status, is_equipe)
  VALUES (COALESCE(_nome, 'Equipe'), _user_id, 'ativo', true)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_or_create_ficha_equipe_de(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_listar_equipe_fichas()
RETURNS TABLE(user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, COALESCE(NULLIF(p.full_name, ''), 'Sem nome')
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
    AND EXISTS (
      SELECT 1 FROM public.user_roles c
      WHERE c.user_id = auth.uid()
        AND c.role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
    )
  ORDER BY 2;
$$;

GRANT EXECUTE ON FUNCTION public.fn_listar_equipe_fichas() TO authenticated;