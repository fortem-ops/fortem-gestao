ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS is_equipe boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_alunos_is_equipe ON public.alunos (user_id) WHERE is_equipe;

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

  SELECT COALESCE(NULLIF(p.nome, ''), 'Equipe') INTO _nome
  FROM public.profiles p WHERE p.id = _uid;

  INSERT INTO public.alunos (nome, user_id, status, is_equipe)
  VALUES (COALESCE(_nome, 'Equipe'), _uid, 'ativo', true)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_or_create_ficha_equipe() TO authenticated;