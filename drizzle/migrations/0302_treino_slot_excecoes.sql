CREATE TABLE public.treino_slot_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.treino_slots(id) ON DELETE CASCADE,
  data date NOT NULL,
  horario_inicio time without time zone NOT NULL,
  horario_fim time without time zone NOT NULL,
  capacidade_maxima smallint NOT NULL CHECK (capacidade_maxima >= 1),
  instrutor_id uuid NULL,
  modalidade text NOT NULL DEFAULT 'treino',
  observacoes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT treino_slot_excecoes_slot_data_unique UNIQUE (slot_id, data),
  CONSTRAINT treino_slot_excecoes_horario_check CHECK (horario_fim > horario_inicio)
);

CREATE INDEX idx_treino_slot_excecoes_data ON public.treino_slot_excecoes (data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_slot_excecoes TO authenticated;
GRANT ALL ON public.treino_slot_excecoes TO service_role;

ALTER TABLE public.treino_slot_excecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_treino_slot_excecoes"
  ON public.treino_slot_excecoes
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "aluno_read_treino_slot_excecoes"
  ON public.treino_slot_excecoes
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.fn_agendar_treino(p_slot_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_id uuid;
  _slot treino_slots%ROWTYPE;
  _exc treino_slot_excecoes%ROWTYPE;
  _horario_inicio time without time zone;
  _horario_fim time without time zone;
  _capacidade smallint;
  _modalidade text;
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

  SELECT * INTO _exc FROM treino_slot_excecoes WHERE slot_id = p_slot_id AND data = p_data;
  _horario_inicio := COALESCE(_exc.horario_inicio, _slot.horario_inicio);
  _horario_fim := COALESCE(_exc.horario_fim, _slot.horario_fim);
  _capacidade := COALESCE(_exc.capacidade_maxima, _slot.capacidade_maxima);
  _modalidade := COALESCE(_exc.modalidade, _slot.modalidade);

  IF p_data < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'data_passada');
  END IF;

  IF p_data = CURRENT_DATE
     AND ((p_data + _horario_inicio) AT TIME ZONE 'America/Sao_Paulo') <= now() THEN
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

  IF _vagas_ocupadas >= _capacidade THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_vagas');
  END IF;

  -- Corrida: sem controle de créditos, exige plano de Corrida vigente (contrato ou plano adicional)
  IF _modalidade = 'corrida' THEN
    IF NOT public.fn_tem_plano_corrida(_aluno_id, p_data) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'sem_plano_corrida');
    END IF;

    INSERT INTO treino_agendamentos (
      aluno_id, slot_id, data, horario_inicio, horario_fim,
      status, ciclo_id, credito_debitado, created_by
    ) VALUES (
      _aluno_id, p_slot_id, p_data, _horario_inicio, _horario_fim,
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
    _aluno_id, p_slot_id, p_data, _horario_inicio, _horario_fim,
    'agendado', _ciclo.id, true, auth.uid()
  ) RETURNING id INTO _agendamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'agendamento_id', _agendamento_id,
    'creditos_restantes', (_ciclo.creditos_liberados - _ciclo.creditos_usados - 1)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_processar_horarios_fixos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _hf RECORD;
  _semana date;
  _data date;
  _vagas_ocupadas integer;
  _slot treino_slots%ROWTYPE;
  _exc treino_slot_excecoes%ROWTYPE;
  _capacidade smallint;
  _h_inicio time without time zone;
  _h_fim time without time zone;
  _plano_fim date;
  _ciclo_id uuid;
  _criados integer := 0;
  _sem_vaga integer := 0;
  _sem_credito integer := 0;
  _notificacoes jsonb := '[]'::jsonb;
BEGIN
  FOR _hf IN
    SELECT hf.*
    FROM treino_horarios_fixos hf
    WHERE hf.ativo = true
      AND (hf.pausado_ate IS NULL OR hf.pausado_ate < CURRENT_DATE)
  LOOP
    SELECT (public.fn_plano_principal_ativo(_hf.aluno_id)).data_fim INTO _plano_fim;

    IF _plano_fim IS NULL THEN CONTINUE; END IF;

    SELECT * INTO _slot FROM treino_slots WHERE id = _hf.slot_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    FOR i IN 0..3 LOOP
      _semana := CURRENT_DATE + (i * 7);
      _data := _semana - EXTRACT(DOW FROM _semana)::integer + _hf.dia_semana;

      IF _data <= CURRENT_DATE OR _data > _plano_fim THEN CONTINUE; END IF;

      IF EXISTS (
        SELECT 1 FROM treino_agendamentos
        WHERE aluno_id = _hf.aluno_id
          AND data = _data
          AND status IN ('agendado','confirmado')
      ) THEN CONTINUE; END IF;

      SELECT * INTO _exc FROM treino_slot_excecoes WHERE slot_id = _hf.slot_id AND data = _data;
      _capacidade := COALESCE(_exc.capacidade_maxima, _slot.capacidade_maxima);
      _h_inicio := COALESCE(_exc.horario_inicio, _hf.horario_inicio);
      _h_fim := COALESCE(_exc.horario_fim, _hf.horario_fim);

      SELECT COUNT(*) INTO _vagas_ocupadas
      FROM treino_agendamentos
      WHERE slot_id = _hf.slot_id
        AND data = _data
        AND status IN ('agendado','confirmado');

      IF _vagas_ocupadas >= _capacidade THEN
        _sem_vaga := _sem_vaga + 1;
        _notificacoes := _notificacoes || jsonb_build_object(
          'aluno_id', _hf.aluno_id,
          'data', _data,
          'horario', _h_inicio,
          'motivo', 'sem_vaga'
        );
        CONTINUE;
      END IF;

      SELECT cc.id INTO _ciclo_id
      FROM ciclos_credito cc
      JOIN contratos c ON c.id = cc.contrato_id
      WHERE c.aluno_id = _hf.aluno_id
        AND cc.status = 'ativo'
        AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
        AND (cc.creditos_liberados - cc.creditos_usados) > 0
      ORDER BY cc.created_at DESC
      LIMIT 1;

      IF _ciclo_id IS NULL THEN
        _sem_credito := _sem_credito + 1;
        _notificacoes := _notificacoes || jsonb_build_object(
          'aluno_id', _hf.aluno_id,
          'data', _data,
          'horario', _h_inicio,
          'motivo', 'sem_creditos'
        );
        CONTINUE;
      END IF;

      UPDATE ciclos_credito
      SET creditos_usados = creditos_usados + 1
      WHERE id = _ciclo_id;

      -- Verificar antes de inserir (substitui ON CONFLICT DO NOTHING em índice parcial)
      IF NOT EXISTS (
        SELECT 1 FROM treino_agendamentos
        WHERE aluno_id = _hf.aluno_id
          AND data = _data
          AND status IN ('agendado','confirmado')
      ) THEN
        INSERT INTO treino_agendamentos (
          aluno_id, slot_id, data, horario_inicio, horario_fim,
          status, credito_debitado, ciclo_id, observacoes
        ) VALUES (
          _hf.aluno_id, _hf.slot_id, _data, _h_inicio, _h_fim,
          'agendado', true, _ciclo_id, 'horario_fixo'
        );
        _criados := _criados + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'criados', _criados,
    'sem_vaga', _sem_vaga,
    'sem_creditos', _sem_credito,
    'notificacoes', _notificacoes
  );
END;
$function$;