
-- Tabela de slots (horários semanais)
CREATE TABLE public.treino_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  capacidade_maxima smallint NOT NULL DEFAULT 8,
  instrutor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dia_semana, horario_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_slots TO authenticated;
GRANT ALL ON public.treino_slots TO service_role;

ALTER TABLE public.treino_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_treino_slots" ON public.treino_slots
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "aluno_read_treino_slots" ON public.treino_slots
  FOR SELECT USING (ativo = true AND auth.uid() IS NOT NULL);

-- Tabela de agendamentos
CREATE TABLE public.treino_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.treino_slots(id) ON DELETE RESTRICT,
  data date NOT NULL,
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','cancelado','faltou','realizado')),
  ciclo_id uuid REFERENCES public.ciclos_credito(id) ON DELETE SET NULL,
  credito_debitado boolean NOT NULL DEFAULT false,
  cancelado_em timestamptz,
  cancelado_por text CHECK (cancelado_por IN ('aluno','staff')),
  credito_estornado boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um aluno só pode ter UM agendamento ativo por data
CREATE UNIQUE INDEX treino_agendamentos_aluno_data_ativo_uniq
  ON public.treino_agendamentos (aluno_id, data)
  WHERE status IN ('agendado', 'confirmado');

CREATE INDEX treino_agendamentos_data_slot_idx ON public.treino_agendamentos (data, slot_id);
CREATE INDEX treino_agendamentos_aluno_data_idx ON public.treino_agendamentos (aluno_id, data);
CREATE INDEX treino_agendamentos_status_data_idx ON public.treino_agendamentos (status, data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_agendamentos TO authenticated;
GRANT ALL ON public.treino_agendamentos TO service_role;

ALTER TABLE public.treino_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_treino_agendamentos" ON public.treino_agendamentos
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "aluno_own_treino_agendamentos" ON public.treino_agendamentos
  FOR ALL USING (
    aluno_id = public.fn_current_aluno_id() AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    aluno_id = public.fn_current_aluno_id() AND auth.uid() IS NOT NULL
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_treino_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER treino_slots_touch BEFORE UPDATE ON public.treino_slots
  FOR EACH ROW EXECUTE FUNCTION public.tg_treino_touch_updated_at();

CREATE TRIGGER treino_agendamentos_touch BEFORE UPDATE ON public.treino_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_treino_touch_updated_at();

-- RPC: agendar treino
CREATE OR REPLACE FUNCTION public.fn_agendar_treino(
  p_slot_id uuid,
  p_data date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF EXISTS (
    SELECT 1 FROM treino_agendamentos
    WHERE aluno_id = _aluno_id AND data = p_data
    AND status IN ('agendado', 'confirmado')
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
$$;

-- RPC: cancelar agendamento
CREATE OR REPLACE FUNCTION public.fn_cancelar_treino_agendamento(
  p_agendamento_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno_id uuid;
  _ag treino_agendamentos%ROWTYPE;
  _deadline timestamptz;
  _dentro_prazo boolean;
BEGIN
  _aluno_id := fn_current_aluno_id();

  SELECT * INTO _ag FROM treino_agendamentos
  WHERE id = p_agendamento_id
  AND aluno_id = _aluno_id
  AND status IN ('agendado', 'confirmado');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'agendamento_invalido');
  END IF;

  _deadline := (_ag.data + _ag.horario_inicio)::timestamptz - interval '1 hour';
  _dentro_prazo := now() < _deadline;

  IF _dentro_prazo AND _ag.credito_debitado AND _ag.ciclo_id IS NOT NULL THEN
    UPDATE ciclos_credito
    SET creditos_usados = GREATEST(0, creditos_usados - 1)
    WHERE id = _ag.ciclo_id;
  END IF;

  UPDATE treino_agendamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = 'aluno',
    credito_estornado = _dentro_prazo
  WHERE id = p_agendamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'credito_estornado', _dentro_prazo,
    'mensagem', CASE WHEN _dentro_prazo
      THEN 'Agendamento cancelado e crédito estornado.'
      ELSE 'Agendamento cancelado. Crédito não estornado (cancelamento fora do prazo de 1h).'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_agendar_treino(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_treino_agendamento(uuid) TO authenticated;
