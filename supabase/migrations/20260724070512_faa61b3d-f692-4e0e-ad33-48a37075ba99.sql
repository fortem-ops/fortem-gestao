
CREATE OR REPLACE FUNCTION public.fn_excluir_horario_fixo(p_horario_fixo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno_id uuid;
  _hf_aluno_id uuid;
  _slot_id uuid;
  _cancelados int := 0;
  _ag record;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  SELECT aluno_id, slot_id INTO _hf_aluno_id, _slot_id
  FROM treino_horarios_fixos
  WHERE id = p_horario_fixo_id
    AND aluno_id = _aluno_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  END IF;

  FOR _ag IN
    SELECT id, credito_debitado, ciclo_id
    FROM treino_agendamentos
    WHERE aluno_id = _hf_aluno_id
      AND slot_id = _slot_id
      AND data >= CURRENT_DATE
      AND status IN ('agendado', 'confirmado')
      AND observacoes = 'horario_fixo'
  LOOP
    IF _ag.credito_debitado AND _ag.ciclo_id IS NOT NULL THEN
      UPDATE ciclos_credito
      SET creditos_usados = GREATEST(0, creditos_usados - 1)
      WHERE id = _ag.ciclo_id;
    END IF;

    UPDATE treino_agendamentos SET
      status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = 'aluno',
      credito_estornado = COALESCE(credito_estornado, false) OR _ag.credito_debitado
    WHERE id = _ag.id;

    _cancelados := _cancelados + 1;
  END LOOP;

  UPDATE treino_horarios_fixos
  SET ativo = false, updated_at = now()
  WHERE id = p_horario_fixo_id;

  RETURN jsonb_build_object('ok', true, 'cancelados', _cancelados);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_excluir_horario_fixo(uuid) TO authenticated;
