CREATE OR REPLACE FUNCTION public.fn_tem_plano_corrida(p_aluno_id uuid, p_data date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $f$
BEGIN
  -- Chamador autenticado só consulta a si mesmo, salvo equipe
  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = p_aluno_id AND a.user_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role <> 'aluno') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.aluno_id = p_aluno_id
      AND c.status = 'ativo'
      AND c.plano_tipo = 'corrida'
      AND (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
  ) OR EXISTS (
    -- Plano adicional de Corrida (sem contrato próprio). Plano do próximo ciclo
    -- criado antecipadamente fica ativo=false e/ou com data_inicio futura: não libera.
    SELECT 1 FROM planos p
    WHERE p.aluno_id = p_aluno_id
      AND p.ativo = true
      AND p.tipo ILIKE 'Corrida%'
      AND p.data_inicio <= p_data
      AND (p.data_fim IS NULL OR p.data_fim >= p_data)
  );
END;
$f$;
REVOKE ALL ON FUNCTION public.fn_tem_plano_corrida(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_tem_plano_corrida(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_agendar_treino(p_slot_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_id uuid;
  _slot treino_slots%ROWTYPE;
  _vagas_ocupadas int;
  _ciclo ciclos_credito%ROWTYPE;
  _agendamento_id uuid;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  -- E5b: aluno só com Consultoria Online não agenda pelo app (equipe usa fn_agendar_servico_equipe)
  IF public.fn_aluno_somente_online(_aluno_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'somente_online');
  END IF;

  SELECT * INTO _slot FROM treino_slots WHERE id = p_slot_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'slot_invalido');
  END IF;

  IF EXTRACT(DOW FROM p_data)::smallint != _slot.dia_semana THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'dia_invalido');
  END IF;

  IF p_data < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'data_passada');
  END IF;

  IF p_data = CURRENT_DATE
     AND ((p_data + _slot.horario_inicio) AT TIME ZONE 'America/Sao_Paulo') <= now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_passado');
  END IF;

  -- Lock por aluno+dia para evitar corrida entre requisições simultâneas
  PERFORM pg_advisory_xact_lock(hashtext(_aluno_id::text || p_data::text));

  -- Aluno: no máximo 1 agendamento ativo por dia, de QUALQUER modalidade
  IF EXISTS (
    SELECT 1
    FROM treino_agendamentos a
    WHERE a.aluno_id = _aluno_id
      AND a.data = p_data
      AND a.status IN ('agendado', 'confirmado')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_agendado_neste_dia');
  END IF;

  SELECT COUNT(*) INTO _vagas_ocupadas
  FROM treino_agendamentos
  WHERE slot_id = p_slot_id AND data = p_data
  AND status IN ('agendado', 'confirmado');

  IF _vagas_ocupadas >= _slot.capacidade_maxima THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_vagas');
  END IF;

  -- Corrida: sem controle de créditos, exige plano de Corrida vigente (contrato ou plano adicional)
  IF _slot.modalidade = 'corrida' THEN
    IF NOT public.fn_tem_plano_corrida(_aluno_id, p_data) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'sem_plano_corrida');
    END IF;

    INSERT INTO treino_agendamentos (
      aluno_id, slot_id, data, horario_inicio, horario_fim,
      status, ciclo_id, credito_debitado, created_by
    ) VALUES (
      _aluno_id, p_slot_id, p_data, _slot.horario_inicio, _slot.horario_fim,
      'agendado', NULL, false, auth.uid()
    ) RETURNING id INTO _agendamento_id;

    RETURN jsonb_build_object('ok', true, 'agendamento_id', _agendamento_id);
  END IF;

  SELECT cc.* INTO _ciclo
  FROM ciclos_credito cc
  JOIN contratos c ON c.id = cc.contrato_id
  WHERE c.aluno_id = _aluno_id
  AND cc.status = 'ativo'
  AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
  AND (cc.creditos_liberados - cc.creditos_usados) > 0
  ORDER BY cc.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_creditos');
  END IF;

  UPDATE ciclos_credito
  SET creditos_usados = creditos_usados + 1
  WHERE id = _ciclo.id;

  INSERT INTO treino_agendamentos (
    aluno_id, slot_id, data, horario_inicio, horario_fim,
    status, ciclo_id, credito_debitado, created_by
  ) VALUES (
    _aluno_id, p_slot_id, p_data, _slot.horario_inicio, _slot.horario_fim,
    'agendado', _ciclo.id, true, auth.uid()
  ) RETURNING id INTO _agendamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'agendamento_id', _agendamento_id,
    'creditos_restantes', (_ciclo.creditos_liberados - _ciclo.creditos_usados - 1)
  );
END;
$function$;