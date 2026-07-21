
ALTER TABLE public.treino_agendamentos ADD COLUMN IF NOT EXISTS observacoes text;

CREATE TABLE IF NOT EXISTS public.treino_horarios_fixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.treino_slots(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  pausado_ate date,
  criado_por text NOT NULL DEFAULT 'aluno' CHECK (criado_por IN ('aluno','staff')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, dia_semana)
);

CREATE INDEX IF NOT EXISTS idx_hf_aluno_ativo ON public.treino_horarios_fixos (aluno_id, ativo);
CREATE INDEX IF NOT EXISTS idx_hf_slot_ativo ON public.treino_horarios_fixos (slot_id, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_horarios_fixos TO authenticated;
GRANT ALL ON public.treino_horarios_fixos TO service_role;

ALTER TABLE public.treino_horarios_fixos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_horarios_fixos" ON public.treino_horarios_fixos;
CREATE POLICY "staff_all_horarios_fixos" ON public.treino_horarios_fixos
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "aluno_own_horarios_fixos" ON public.treino_horarios_fixos;
CREATE POLICY "aluno_own_horarios_fixos" ON public.treino_horarios_fixos
  FOR ALL TO authenticated
  USING (aluno_id = public.fn_current_aluno_id())
  WITH CHECK (aluno_id = public.fn_current_aluno_id());

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at_hf()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_hf_updated_at ON public.treino_horarios_fixos;
CREATE TRIGGER trg_hf_updated_at BEFORE UPDATE ON public.treino_horarios_fixos
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_hf();

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
  _criados integer := 0;
  _sem_vaga integer := 0;
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

      INSERT INTO treino_agendamentos (
        aluno_id, slot_id, data, horario_inicio, horario_fim,
        status, credito_debitado, observacoes
      ) VALUES (
        _hf.aluno_id, _hf.slot_id, _data, _hf.horario_inicio, _hf.horario_fim,
        'agendado', false, 'horario_fixo'
      )
      ON CONFLICT DO NOTHING;

      _criados := _criados + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'criados', _criados,
    'sem_vaga', _sem_vaga,
    'notificacoes', _notificacoes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_processar_horarios_fixos() TO authenticated, service_role;
