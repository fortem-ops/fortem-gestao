CREATE OR REPLACE FUNCTION public.fn_agendar_treino_equipe(
  p_slot_id uuid,
  p_data date,
  p_aluno_id uuid,
  p_ignorar_capacidade boolean DEFAULT true,
  p_agenda_servico_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _aluno_status text;
  _slot public.treino_slots%ROWTYPE;
  _exc public.treino_slot_excecoes%ROWTYPE;
  _plano public.planos%ROWTYPE;
  _ciclo public.ciclos_credito%ROWTYPE;
  _horario_inicio time without time zone;
  _horario_fim time without time zone;
  _capacidade smallint;
  _modalidade text;
  _vagas_ocupadas int;
  _agendamento_id uuid;
  _eh_agregadora boolean := false;
  _eh_livre boolean := false;
  _debitado boolean := false;
  _ciclo_id uuid := NULL;
  _creditos_restantes int := NULL;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT a.status INTO _aluno_status
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND a.status IN ('ativo', 'prospect')
    AND NOT COALESCE(a.is_equipe, false);

  IF _aluno_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_invalido');
  END IF;

  IF _aluno_status = 'prospect' THEN
    IF p_agenda_servico_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.agenda_servicos s
      WHERE s.id = p_agenda_servico_id
        AND s.aluno_id = p_aluno_id
        AND s.atividade = 'Treino Experimental'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'experimental_obrigatorio');
    END IF;
  END IF;

  SELECT * INTO _slot FROM public.treino_slots WHERE id = p_slot_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'slot_invalido');
  END IF;

  IF EXTRACT(DOW FROM p_data)::smallint != _slot.dia_semana THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'dia_invalido');
  END IF;

  SELECT * INTO _exc FROM public.treino_slot_excecoes WHERE slot_id = p_slot_id AND data = p_data;
  _horario_inicio := COALESCE(_exc.horario_inicio, _slot.horario_inicio);
  _horario_fim := COALESCE(_exc.horario_fim, _slot.horario_fim);
  _capacidade := COALESCE(_exc.capacidade_maxima, _slot.capacidade_maxima);
  _modalidade := COALESCE(_exc.modalidade, _slot.modalidade);

  PERFORM pg_advisory_xact_lock(hashtext(p_aluno_id::text || p_data::text));

  IF EXISTS (
    SELECT 1
    FROM public.treino_agendamentos a
    WHERE a.aluno_id = p_aluno_id
      AND a.slot_id = p_slot_id
      AND a.data = p_data
      AND a.status IN ('agendado', 'confirmado')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_agendado_neste_horario');
  END IF;

  SELECT COUNT(*) INTO _vagas_ocupadas
  FROM public.treino_agendamentos
  WHERE slot_id = p_slot_id
    AND data = p_data
    AND status IN ('agendado', 'confirmado');

  IF NOT COALESCE(p_ignorar_capacidade, true) AND _vagas_ocupadas >= _capacidade THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_vagas');
  END IF;

  IF _aluno_status = 'ativo' AND _modalidade <> 'corrida' THEN
    SELECT * INTO _plano FROM public.fn_plano_principal_ativo(p_aluno_id);

    IF lower(COALESCE(_plano.tipo, '')) IN ('gympass', 'wellhub', 'total pass', 'totalpass') THEN
      _eh_agregadora := true;
    ELSIF _plano.id IS NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.contratos c
        WHERE c.aluno_id = p_aluno_id
          AND c.status = 'ativo'
          AND c.plano_tipo IN ('gympass', 'wellhub', 'totalpass')
      ) INTO _eh_agregadora;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.contratos c
      WHERE c.aluno_id = p_aluno_id
        AND c.status = 'ativo'
        AND c.frequencia_semanal = 5
        AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
    ) INTO _eh_livre;

    IF NOT _eh_agregadora AND NOT _eh_livre THEN
      SELECT cc.* INTO _ciclo
      FROM public.ciclos_credito cc
      JOIN public.contratos c ON c.id = cc.contrato_id
      WHERE c.aluno_id = p_aluno_id
        AND cc.status = 'ativo'
        AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
      ORDER BY ((cc.creditos_liberados - cc.creditos_usados) > 0) DESC, cc.created_at DESC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.ciclos_credito
        SET creditos_usados = creditos_usados + 1
        WHERE id = _ciclo.id;

        _debitado := true;
        _ciclo_id := _ciclo.id;
        _creditos_restantes := (_ciclo.creditos_liberados - _ciclo.creditos_usados - 1);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.treino_agendamentos (
    aluno_id, slot_id, data, horario_inicio, horario_fim,
    status, ciclo_id, credito_debitado, created_by, agenda_servico_id
  ) VALUES (
    p_aluno_id, p_slot_id, p_data, _horario_inicio, _horario_fim,
    'agendado', _ciclo_id, _debitado, auth.uid(), p_agenda_servico_id
  ) RETURNING id INTO _agendamento_id;

  INSERT INTO public.audit_log (user_id, operacao, tabela, registro_id, dados_depois)
  VALUES (
    auth.uid(),
    'insert',
    'treino_agendamentos',
    _agendamento_id::text,
    jsonb_build_object(
      'origem', 'equipe_agenda_treinos',
      'aluno_id', p_aluno_id,
      'slot_id', p_slot_id,
      'data', p_data,
      'credito_debitado', _debitado,
      'acima_capacidade', (_vagas_ocupadas >= _capacidade),
      'agenda_servico_id', p_agenda_servico_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'agendamento_id', _agendamento_id,
    'credito_debitado', _debitado,
    'creditos_restantes', _creditos_restantes,
    'acima_capacidade', (_vagas_ocupadas >= _capacidade)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean, uuid) TO authenticated, service_role;
