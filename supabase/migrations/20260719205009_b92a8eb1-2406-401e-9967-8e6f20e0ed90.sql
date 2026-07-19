
CREATE OR REPLACE FUNCTION public.fn_staff_excluir_treino_agendamento(
  p_agendamento_id uuid,
  p_estornar boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _ag treino_agendamentos%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT * INTO _ag FROM treino_agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  END IF;

  IF p_estornar AND _ag.credito_debitado AND _ag.ciclo_id IS NOT NULL
     AND NOT COALESCE(_ag.credito_estornado, false) THEN
    UPDATE ciclos_credito
    SET creditos_usados = GREATEST(0, creditos_usados - 1)
    WHERE id = _ag.ciclo_id;
  END IF;

  UPDATE treino_agendamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = 'staff',
    credito_estornado = p_estornar
  WHERE id = p_agendamento_id;

  RETURN jsonb_build_object('ok', true, 'credito_estornado', p_estornar);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_staff_excluir_treino_agendamento(uuid, boolean) TO authenticated;
