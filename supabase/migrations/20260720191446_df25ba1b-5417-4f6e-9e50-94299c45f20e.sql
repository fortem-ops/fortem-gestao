
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS senha_hash text,
  ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;

CREATE OR REPLACE FUNCTION public.fn_parceiro_login(
  p_email text,
  p_senha text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _parceiro public.parceiros%ROWTYPE;
BEGIN
  SELECT * INTO _parceiro
  FROM public.parceiros
  WHERE lower(email_login) = lower(p_email)
    AND ativo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Parceiro não encontrado ou inativo');
  END IF;

  IF _parceiro.senha_hash IS NULL OR _parceiro.senha_hash <> extensions.crypt(p_senha, _parceiro.senha_hash) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Senha incorreta');
  END IF;

  UPDATE public.parceiros SET ultimo_acesso = now() WHERE id = _parceiro.id;

  RETURN jsonb_build_object(
    'ok', true,
    'parceiro_id', _parceiro.id,
    'nome', _parceiro.nome,
    'categoria', _parceiro.categoria,
    'modo_validacao', _parceiro.modo_validacao
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_parceiro_set_senha(
  p_parceiro_id uuid,
  p_senha text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.parceiros
    SET senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf'))
    WHERE id = p_parceiro_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_parceiro_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_parceiro_set_senha(uuid, text) TO authenticated;
