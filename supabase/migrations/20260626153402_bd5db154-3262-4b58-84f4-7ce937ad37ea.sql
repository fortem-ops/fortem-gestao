CREATE OR REPLACE FUNCTION public.fn_ponto_criar_jornada_manual(
  _user_id uuid,
  _data date,
  _motivo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp uuid := auth.uid();
  _id uuid;
  _resp_nome text;
BEGIN
  IF _resp IS NULL OR NOT public.is_coordinator_or_admin(_resp) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mín. 3 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF _data IS NULL OR _data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data inválida' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO _id FROM public.ponto_jornadas
   WHERE usuario_id = _user_id AND data = _data
   LIMIT 1;

  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  SELECT full_name INTO _resp_nome FROM public.profiles WHERE user_id = _resp;

  INSERT INTO public.ponto_jornadas (usuario_id, data, status, observacao)
  VALUES (
    _user_id,
    _data,
    'em_andamento'::ponto_jornada_status,
    'Criada manualmente por ' || COALESCE(_resp_nome, _resp::text) || ': ' || _motivo
  )
  RETURNING id INTO _id;

  INSERT INTO public.ponto_ajustes_log (jornada_id, usuario_alvo_id, responsavel_id, campo, valor_antes, valor_depois, motivo)
  VALUES (_id, _user_id, _resp, 'criacao_manual', NULL, _data::text, _motivo);

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ponto_criar_jornada_manual(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ponto_criar_jornada_manual(uuid, date, text) TO authenticated;