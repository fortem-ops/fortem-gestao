CREATE OR REPLACE FUNCTION public.fn_cancelar_agendamento_servico(p_agenda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno_id uuid;
  _reg record;
BEGIN
  _aluno_id := public.fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_nao_encontrado');
  END IF;

  SELECT * INTO _reg FROM public.agenda_servicos WHERE id = p_agenda_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'agendamento_nao_encontrado');
  END IF;

  IF _reg.aluno_id IS DISTINCT FROM _aluno_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autorizado');
  END IF;

  IF _reg.data_especifica IS NULL OR _reg.data_especifica < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'data_passada');
  END IF;

  DELETE FROM public.agenda_servicos WHERE id = p_agenda_id;

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Agendamento cancelado com sucesso.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_cancelar_agendamento_servico(uuid) TO authenticated;