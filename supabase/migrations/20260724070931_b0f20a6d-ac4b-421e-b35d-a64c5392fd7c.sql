
CREATE OR REPLACE FUNCTION public.fn_processar_horarios_fixos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hf RECORD;
  _semana date;
  _data date;
  _vagas_ocupadas integer;
  _slot treino_slots%ROWTYPE;
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
    SELECT data_fim INTO _plano_fim
    FROM planos
    WHERE aluno_id = _hf.aluno_id AND ativo = true
    ORDER BY created_at DESC LIMIT 1;

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

      SELECT COUNT(*) INTO _vagas_ocupadas
      FROM treino_agendamentos
      WHERE slot_id = _hf.slot_id
        AND data = _data
        AND status IN ('agendado','confirmado');

      IF _vagas_ocupadas >= _slot.capacidade_maxima THEN
        _sem_vaga := _sem_vaga + 1;
        _notificacoes := _notificacoes || jsonb_build_object(
          'aluno_id', _hf.aluno_id,
          'data', _data,
          'horario', _hf.horario_inicio,
          'motivo', 'sem_vaga'
        );
        CONTINUE;
      END IF;

      SELECT cc.id INTO _ciclo_id
      FROM ciclos_credito cc
      JOIN contratos c ON c.id = cc.contrato_id
      WHERE c.aluno_id = _hf.aluno_id
        AND cc.status = 'ativo'
        AND cc.data_fim >= CURRENT_DATE
        AND (cc.creditos_liberados - cc.creditos_usados) > 0
      ORDER BY cc.created_at DESC
      LIMIT 1;

      IF _ciclo_id IS NULL THEN
        _sem_credito := _sem_credito + 1;
        _notificacoes := _notificacoes || jsonb_build_object(
          'aluno_id', _hf.aluno_id,
          'data', _data,
          'horario', _hf.horario_inicio,
          'motivo', 'sem_creditos'
        );
        CONTINUE;
      END IF;

      UPDATE ciclos_credito
      SET creditos_usados = creditos_usados + 1
      WHERE id = _ciclo_id;

      INSERT INTO treino_agendamentos (
        aluno_id, slot_id, data, horario_inicio, horario_fim,
        status, credito_debitado, ciclo_id, observacoes
      ) VALUES (
        _hf.aluno_id, _hf.slot_id, _data, _hf.horario_inicio, _hf.horario_fim,
        'agendado', true, _ciclo_id, 'horario_fixo'
      )
      ON CONFLICT DO NOTHING;

      _criados := _criados + 1;
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
$$;
