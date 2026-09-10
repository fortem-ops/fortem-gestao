CREATE OR REPLACE FUNCTION public.fn_loja_vincular_aluno(p_pedido_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cpf text;
  _atual uuid;
  _aluno uuid;
BEGIN
  SELECT regexp_replace(coalesce(cpf,''), '\D', '', 'g'), aluno_id
    INTO _cpf, _atual
  FROM public.pedidos WHERE id = p_pedido_id;

  IF _atual IS NOT NULL THEN RETURN _atual; END IF;
  IF _cpf IS NULL OR length(_cpf) <> 11 THEN RETURN NULL; END IF;

  SELECT id INTO _aluno
  FROM public.alunos
  WHERE cpf_hash = encode(sha256(_cpf::bytea), 'hex')
  LIMIT 1;

  IF _aluno IS NULL THEN RETURN NULL; END IF;

  UPDATE public.pedidos SET aluno_id = _aluno WHERE id = p_pedido_id;
  RETURN _aluno;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_loja_vincular_aluno(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loja_vincular_aluno(uuid) TO service_role;