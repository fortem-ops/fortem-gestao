-- 1. Tabela de fila de espera do portal (treinos e serviços)
CREATE TABLE IF NOT EXISTS public.portal_fila_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('treino', 'servico')),
  slot_id uuid REFERENCES public.treino_slots(id) ON DELETE CASCADE,
  agenda_servico_id uuid REFERENCES public.agenda_servicos(id) ON DELETE CASCADE,
  data date NOT NULL,
  horario_inicio time without time zone NOT NULL,
  horario_fim time without time zone NOT NULL,
  atividade text NOT NULL,
  profissional_id uuid,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'saiu', 'agendou', 'encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_portal_fila_espera_alvo CHECK (
    (tipo = 'treino' AND slot_id IS NOT NULL AND agenda_servico_id IS NULL)
    OR (tipo = 'servico' AND agenda_servico_id IS NOT NULL AND slot_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_fila_espera_treino_ativo
  ON public.portal_fila_espera (aluno_id, slot_id, data)
  WHERE status = 'ativo' AND tipo = 'treino';

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_fila_espera_servico_ativo
  ON public.portal_fila_espera (aluno_id, agenda_servico_id, data)
  WHERE status = 'ativo' AND tipo = 'servico';

CREATE INDEX IF NOT EXISTS idx_portal_fila_espera_treino_busca
  ON public.portal_fila_espera (slot_id, data)
  WHERE status = 'ativo' AND tipo = 'treino';

CREATE INDEX IF NOT EXISTS idx_portal_fila_espera_servico_busca
  ON public.portal_fila_espera (profissional_id, data, horario_inicio)
  WHERE status = 'ativo' AND tipo = 'servico';

CREATE INDEX IF NOT EXISTS idx_portal_fila_espera_aluno_ativo
  ON public.portal_fila_espera (aluno_id, data, horario_inicio)
  WHERE status = 'ativo';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_fila_espera TO authenticated;
GRANT ALL ON public.portal_fila_espera TO service_role;

ALTER TABLE public.portal_fila_espera ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aluno_select_own_fila ON public.portal_fila_espera;
CREATE POLICY aluno_select_own_fila
  ON public.portal_fila_espera
  FOR SELECT
  TO authenticated
  USING (aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS aluno_insert_own_fila ON public.portal_fila_espera;
CREATE POLICY aluno_insert_own_fila
  ON public.portal_fila_espera
  FOR INSERT
  TO authenticated
  WITH CHECK (aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS aluno_update_own_fila ON public.portal_fila_espera;
CREATE POLICY aluno_update_own_fila
  ON public.portal_fila_espera
  FOR UPDATE
  TO authenticated
  USING (aluno_id = public.fn_current_aluno_id())
  WITH CHECK (aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS aluno_delete_own_fila ON public.portal_fila_espera;
CREATE POLICY aluno_delete_own_fila
  ON public.portal_fila_espera
  FOR DELETE
  TO authenticated
  USING (aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS staff_select_fila ON public.portal_fila_espera;
CREATE POLICY staff_select_fila
  ON public.portal_fila_espera
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- 2. Central de notificações do portal: coluna url e leitura do próprio histórico em portal_push_log
ALTER TABLE public.portal_push_log
  ADD COLUMN IF NOT EXISTS url text;

GRANT SELECT ON public.portal_push_log TO authenticated;

DROP POLICY IF EXISTS aluno_select_own_push_log ON public.portal_push_log;
CREATE POLICY aluno_select_own_push_log
  ON public.portal_push_log
  FOR SELECT
  TO authenticated
  USING (aluno_id = public.fn_current_aluno_id());

-- 3. Encerrar entradas cujo horário já começou (fuso Brasília)
CREATE OR REPLACE FUNCTION public.fn_fila_espera_encerrar_expiradas(p_aluno_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _agora timestamp without time zone := (now() AT TIME ZONE 'America/Sao_Paulo');
  _rows integer := 0;
BEGIN
  UPDATE public.portal_fila_espera
     SET status = 'encerrado',
         updated_at = now()
   WHERE status = 'ativo'
     AND (p_aluno_id IS NULL OR aluno_id = p_aluno_id)
     AND (data + horario_inicio) <= _agora;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_fila_espera_encerrar_expiradas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fila_espera_encerrar_expiradas(uuid) TO service_role;

-- 4. Entrar na fila de espera de treino (funcional ou corrida)
CREATE OR REPLACE FUNCTION public.fn_fila_espera_entrar_treino(p_slot_id uuid, p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _aluno_id uuid;
  _aluno record;
  _slot public.treino_slots%ROWTYPE;
  _exc public.treino_slot_excecoes%ROWTYPE;
  _horario_inicio time without time zone;
  _horario_fim time without time zone;
  _capacidade smallint;
  _modalidade text;
  _atividade text;
  _vagas_ocupadas integer;
  _filas_ativas integer;
  _fila_id uuid;
BEGIN
  _aluno_id := public.fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  SELECT id, status, is_equipe INTO _aluno
    FROM public.alunos
   WHERE id = _aluno_id;
  IF _aluno.id IS NULL OR _aluno.status <> 'ativo' OR COALESCE(_aluno.is_equipe, false) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_inativo');
  END IF;

  IF public.fn_aluno_somente_online(_aluno_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'somente_online');
  END IF;

  SELECT * INTO _slot
    FROM public.treino_slots
   WHERE id = p_slot_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'slot_invalido');
  END IF;

  IF EXTRACT(DOW FROM p_data)::smallint <> _slot.dia_semana THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'dia_invalido');
  END IF;

  SELECT * INTO _exc
    FROM public.treino_slot_excecoes
   WHERE slot_id = p_slot_id AND data = p_data;

  _horario_inicio := COALESCE(_exc.horario_inicio, _slot.horario_inicio);
  _horario_fim := COALESCE(_exc.horario_fim, _slot.horario_fim);
  _capacidade := COALESCE(_exc.capacidade_maxima, _slot.capacidade_maxima);
  _modalidade := COALESCE(_exc.modalidade, _slot.modalidade, 'treino');
  _atividade := CASE WHEN _modalidade = 'corrida' THEN 'Corrida' ELSE 'Treino' END;

  IF (p_data + _horario_inicio) <= (now() AT TIME ZONE 'America/Sao_Paulo') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_passado');
  END IF;

  IF _modalidade = 'corrida' AND NOT public.fn_tem_plano_corrida(_aluno_id, p_data) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_plano_corrida');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.treino_agendamentos a
     WHERE a.aluno_id = _aluno_id
       AND a.slot_id = p_slot_id
       AND a.data = p_data
       AND a.status IN ('agendado', 'confirmado')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_agendado');
  END IF;

  SELECT COUNT(*) INTO _vagas_ocupadas
    FROM public.treino_agendamentos
   WHERE slot_id = p_slot_id
     AND data = p_data
     AND status IN ('agendado', 'confirmado', 'realizado', 'faltou');

  IF _vagas_ocupadas < _capacidade THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_com_vaga');
  END IF;

  -- Já está na fila deste horário: idempotente
  SELECT id INTO _fila_id
    FROM public.portal_fila_espera
   WHERE aluno_id = _aluno_id
     AND tipo = 'treino'
     AND slot_id = p_slot_id
     AND data = p_data
     AND status = 'ativo';
  IF _fila_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'fila_id', _fila_id, 'ja_na_fila', true);
  END IF;

  PERFORM public.fn_fila_espera_encerrar_expiradas(_aluno_id);

  SELECT COUNT(*) INTO _filas_ativas
    FROM public.portal_fila_espera
   WHERE aluno_id = _aluno_id
     AND status = 'ativo';
  IF _filas_ativas >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'limite_filas');
  END IF;

  INSERT INTO public.portal_fila_espera (
    aluno_id, tipo, slot_id, data, horario_inicio, horario_fim, atividade, status
  ) VALUES (
    _aluno_id, 'treino', p_slot_id, p_data, _horario_inicio, _horario_fim, _atividade, 'ativo'
  )
  RETURNING id INTO _fila_id;

  RETURN jsonb_build_object('ok', true, 'fila_id', _fila_id, 'ja_na_fila', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_fila_espera_entrar_treino(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fila_espera_entrar_treino(uuid, date) TO authenticated, service_role;

-- 5. Entrar na fila de espera de serviço
CREATE OR REPLACE FUNCTION public.fn_fila_espera_entrar_servico(p_agenda_servico_id uuid, p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _aluno_id uuid;
  _aluno record;
  _tpl public.agenda_servicos%ROWTYPE;
  _ocupado boolean;
  _filas_ativas integer;
  _fila_id uuid;
BEGIN
  _aluno_id := public.fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  SELECT id, status, is_equipe INTO _aluno
    FROM public.alunos
   WHERE id = _aluno_id;
  IF _aluno.id IS NULL OR _aluno.status <> 'ativo' OR COALESCE(_aluno.is_equipe, false) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aluno_inativo');
  END IF;

  IF public.fn_aluno_somente_online(_aluno_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'somente_online');
  END IF;

  SELECT * INTO _tpl
    FROM public.agenda_servicos
   WHERE id = p_agenda_servico_id
     AND aluno_id IS NULL;
  IF _tpl.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_invalido');
  END IF;

  IF (p_data + _tpl.horario_inicio) <= (now() AT TIME ZONE 'America/Sao_Paulo') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_passado');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.agenda_servicos
     WHERE profissional_id = _tpl.profissional_id
       AND data_especifica = p_data
       AND horario_inicio = _tpl.horario_inicio
       AND aluno_id = _aluno_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_agendado');
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.agenda_servicos
     WHERE profissional_id = _tpl.profissional_id
       AND data_especifica = p_data
       AND horario_inicio = _tpl.horario_inicio
       AND aluno_id IS NOT NULL
  ) INTO _ocupado;

  IF NOT _ocupado THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'horario_com_vaga');
  END IF;

  SELECT id INTO _fila_id
    FROM public.portal_fila_espera
   WHERE aluno_id = _aluno_id
     AND tipo = 'servico'
     AND agenda_servico_id = p_agenda_servico_id
     AND data = p_data
     AND status = 'ativo';
  IF _fila_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'fila_id', _fila_id, 'ja_na_fila', true);
  END IF;

  PERFORM public.fn_fila_espera_encerrar_expiradas(_aluno_id);

  SELECT COUNT(*) INTO _filas_ativas
    FROM public.portal_fila_espera
   WHERE aluno_id = _aluno_id
     AND status = 'ativo';
  IF _filas_ativas >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'limite_filas');
  END IF;

  INSERT INTO public.portal_fila_espera (
    aluno_id, tipo, agenda_servico_id, data, horario_inicio, horario_fim, atividade, profissional_id, status
  ) VALUES (
    _aluno_id, 'servico', p_agenda_servico_id, p_data, _tpl.horario_inicio, _tpl.horario_fim, _tpl.atividade, _tpl.profissional_id, 'ativo'
  )
  RETURNING id INTO _fila_id;

  RETURN jsonb_build_object('ok', true, 'fila_id', _fila_id, 'ja_na_fila', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_fila_espera_entrar_servico(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fila_espera_entrar_servico(uuid, date) TO authenticated, service_role;

-- 6. Sair da fila de espera
CREATE OR REPLACE FUNCTION public.fn_fila_espera_sair(p_fila_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _aluno_id uuid;
  _rows integer := 0;
BEGIN
  _aluno_id := public.fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  UPDATE public.portal_fila_espera
     SET status = 'saiu',
         updated_at = now()
   WHERE id = p_fila_id
     AND aluno_id = _aluno_id
     AND status = 'ativo';
  GET DIAGNOSTICS _rows = ROW_COUNT;

  IF _rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_fila_espera_sair(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fila_espera_sair(uuid) TO authenticated, service_role;

-- 7. Disparo de aviso para todos da fila quando abre uma vaga
CREATE OR REPLACE FUNCTION public.fn_fila_espera_notificar_vaga(
  p_tipo text,
  p_slot_id uuid,
  p_profissional_id uuid,
  p_data date,
  p_horario_inicio time without time zone,
  p_liberacao_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _agora timestamp without time zone := (now() AT TIME ZONE 'America/Sao_Paulo');
  _rec record;
  _notificados integer := 0;
  _hhmm text;
  _ddmm text;
  _url text;
BEGIN
  IF p_data IS NULL OR p_horario_inicio IS NULL THEN
    RETURN 0;
  END IF;

  IF (p_data + p_horario_inicio) <= _agora THEN
    PERFORM public.fn_fila_espera_encerrar_expiradas(NULL);
    RETURN 0;
  END IF;

  FOR _rec IN
    SELECT f.id, f.aluno_id, f.tipo, f.data, f.horario_inicio, f.atividade
      FROM public.portal_fila_espera f
      JOIN public.alunos a ON a.id = f.aluno_id
     WHERE f.status = 'ativo'
       AND f.tipo = p_tipo
       AND f.data = p_data
       AND a.status = 'ativo'
       AND NOT COALESCE(a.is_equipe, false)
       AND (
         (p_tipo = 'treino' AND f.slot_id = p_slot_id)
         OR (p_tipo = 'servico' AND f.profissional_id = p_profissional_id AND f.horario_inicio = p_horario_inicio)
       )
  LOOP
    _hhmm := to_char(_rec.horario_inicio, 'HH24:MI');
    _ddmm := to_char(_rec.data, 'DD/MM');
    _url := '/portal/agenda?data=' || to_char(_rec.data, 'YYYY-MM-DD')
      || '&aba=' || CASE WHEN _rec.tipo = 'servico' THEN 'servicos' ELSE 'treinos' END
      || '&horario=' || _hhmm;

    PERFORM public.fn_call_edge_function(
      'send-push-notification',
      jsonb_build_object(
        'aluno_id', _rec.aluno_id,
        'title', 'Vaga liberada às ' || _hhmm,
        'body', 'Abriu uma vaga em ' || _rec.atividade || ' de ' || _ddmm || ' às ' || _hhmm || '. Agende pelo app: a vaga fica com quem confirmar primeiro.',
        'url', _url,
        'gatilho', 'vaga_liberada',
        'referencia', 'vaga_liberada:' || _rec.id::text || ':' || p_liberacao_id
      )
    );
    _notificados := _notificados + 1;
  END LOOP;

  RETURN _notificados;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_fila_espera_notificar_vaga(text, uuid, uuid, date, time without time zone, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fila_espera_notificar_vaga(text, uuid, uuid, date, time without time zone, text) TO service_role;

-- 8. Gatilhos em treino_agendamentos (sai da fila ao agendar; avisa fila ao cancelar/remover)
CREATE OR REPLACE FUNCTION public.trg_fila_espera_treino_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _capacidade integer;
  _ocupadas integer;
  _horario_inicio time without time zone;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('agendado', 'confirmado') THEN
      UPDATE public.portal_fila_espera
         SET status = 'agendou',
             updated_at = now()
       WHERE aluno_id = NEW.aluno_id
         AND tipo = 'treino'
         AND slot_id = NEW.slot_id
         AND data = NEW.data
         AND status = 'ativo';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('agendado', 'confirmado') AND OLD.status NOT IN ('agendado', 'confirmado') THEN
      UPDATE public.portal_fila_espera
         SET status = 'agendou',
             updated_at = now()
       WHERE aluno_id = NEW.aluno_id
         AND tipo = 'treino'
         AND slot_id = NEW.slot_id
         AND data = NEW.data
         AND status = 'ativo';
    END IF;

    IF OLD.status IN ('agendado', 'confirmado') AND NEW.status = 'cancelado' THEN
      SELECT COALESCE(e.capacidade_maxima, s.capacidade_maxima),
             COALESCE(e.horario_inicio, s.horario_inicio)
        INTO _capacidade, _horario_inicio
        FROM public.treino_slots s
        LEFT JOIN public.treino_slot_excecoes e
          ON e.slot_id = s.id AND e.data = OLD.data
       WHERE s.id = OLD.slot_id AND s.ativo = true;

      IF _capacidade IS NOT NULL THEN
        SELECT COUNT(*) INTO _ocupadas
          FROM public.treino_agendamentos
         WHERE slot_id = OLD.slot_id
           AND data = OLD.data
           AND status IN ('agendado', 'confirmado', 'realizado', 'faltou');

        IF _ocupadas < _capacidade THEN
          PERFORM public.fn_fila_espera_notificar_vaga(
            'treino', OLD.slot_id, NULL, OLD.data, COALESCE(_horario_inicio, OLD.horario_inicio),
            'cancel:' || OLD.id::text || ':' || gen_random_uuid()::text
          );
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('agendado', 'confirmado') THEN
      SELECT COALESCE(e.capacidade_maxima, s.capacidade_maxima),
             COALESCE(e.horario_inicio, s.horario_inicio)
        INTO _capacidade, _horario_inicio
        FROM public.treino_slots s
        LEFT JOIN public.treino_slot_excecoes e
          ON e.slot_id = s.id AND e.data = OLD.data
       WHERE s.id = OLD.slot_id AND s.ativo = true;

      IF _capacidade IS NOT NULL THEN
        SELECT COUNT(*) INTO _ocupadas
          FROM public.treino_agendamentos
         WHERE slot_id = OLD.slot_id
           AND data = OLD.data
           AND status IN ('agendado', 'confirmado', 'realizado', 'faltou');

        IF _ocupadas < _capacidade THEN
          PERFORM public.fn_fila_espera_notificar_vaga(
            'treino', OLD.slot_id, NULL, OLD.data, COALESCE(_horario_inicio, OLD.horario_inicio),
            'delete:' || OLD.id::text || ':' || gen_random_uuid()::text
          );
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fila_espera_treino_agendamento ON public.treino_agendamentos;
CREATE TRIGGER trg_fila_espera_treino_agendamento
  AFTER INSERT OR UPDATE OR DELETE ON public.treino_agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fila_espera_treino_agendamento();

-- 9. Gatilho em treino_slots (encerramento ao desativar; aviso ao aumentar capacidade)
CREATE OR REPLACE FUNCTION public.trg_fila_espera_treino_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _rec record;
  _ocupadas integer;
  _cap integer;
BEGIN
  IF NEW.ativo = false AND OLD.ativo = true THEN
    UPDATE public.portal_fila_espera
       SET status = 'encerrado',
           updated_at = now()
     WHERE tipo = 'treino'
       AND slot_id = NEW.id
       AND status = 'ativo';
    RETURN NEW;
  END IF;

  IF NEW.ativo = true AND NEW.capacidade_maxima > OLD.capacidade_maxima THEN
    FOR _rec IN
      SELECT DISTINCT f.data,
             COALESCE(e.capacidade_maxima, NEW.capacidade_maxima) AS cap,
             COALESCE(e.horario_inicio, NEW.horario_inicio) AS ini
        FROM public.portal_fila_espera f
        LEFT JOIN public.treino_slot_excecoes e
          ON e.slot_id = NEW.id AND e.data = f.data
       WHERE f.tipo = 'treino'
         AND f.slot_id = NEW.id
         AND f.status = 'ativo'
    LOOP
      SELECT COUNT(*) INTO _ocupadas
        FROM public.treino_agendamentos
       WHERE slot_id = NEW.id
         AND data = _rec.data
         AND status IN ('agendado', 'confirmado', 'realizado', 'faltou');
      IF _ocupadas < _rec.cap THEN
        PERFORM public.fn_fila_espera_notificar_vaga(
          'treino', NEW.id, NULL, _rec.data, _rec.ini,
          'cap:' || NEW.id::text || ':' || gen_random_uuid()::text
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fila_espera_treino_slot ON public.treino_slots;
CREATE TRIGGER trg_fila_espera_treino_slot
  AFTER UPDATE ON public.treino_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fila_espera_treino_slot();

-- 10. Gatilho em treino_slot_excecoes (aumento de capacidade pontual)
CREATE OR REPLACE FUNCTION public.trg_fila_espera_treino_slot_excecao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _slot_cap integer;
  _slot_ini time without time zone;
  _cap_ant integer;
  _cap_nova integer;
  _ocupadas integer;
BEGIN
  SELECT capacidade_maxima, horario_inicio
    INTO _slot_cap, _slot_ini
    FROM public.treino_slots
   WHERE id = NEW.slot_id AND ativo = true;

  IF _slot_cap IS NULL THEN
    RETURN NEW;
  END IF;

  _cap_ant := CASE WHEN TG_OP = 'INSERT' THEN _slot_cap ELSE COALESCE(OLD.capacidade_maxima, _slot_cap) END;
  _cap_nova := COALESCE(NEW.capacidade_maxima, _slot_cap);

  IF _cap_nova > _cap_ant THEN
    SELECT COUNT(*) INTO _ocupadas
      FROM public.treino_agendamentos
     WHERE slot_id = NEW.slot_id
       AND data = NEW.data
       AND status IN ('agendado', 'confirmado', 'realizado', 'faltou');

    IF _ocupadas < _cap_nova THEN
      PERFORM public.fn_fila_espera_notificar_vaga(
        'treino', NEW.slot_id, NULL, NEW.data, COALESCE(NEW.horario_inicio, _slot_ini),
        'cap_exc:' || NEW.id::text || ':' || gen_random_uuid()::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fila_espera_treino_slot_excecao ON public.treino_slot_excecoes;
CREATE TRIGGER trg_fila_espera_treino_slot_excecao
  AFTER INSERT OR UPDATE ON public.treino_slot_excecoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fila_espera_treino_slot_excecao();

-- 11. Gatilho em agenda_servicos (sai da fila ao agendar; avisa fila ao cancelar/remover; encerra se grade removida)
CREATE OR REPLACE FUNCTION public.trg_fila_espera_agenda_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _ainda_ocupado boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.aluno_id IS NOT NULL AND NEW.data_especifica IS NOT NULL THEN
      UPDATE public.portal_fila_espera
         SET status = 'agendou',
             updated_at = now()
       WHERE aluno_id = NEW.aluno_id
         AND tipo = 'servico'
         AND profissional_id = NEW.profissional_id
         AND data = NEW.data_especifica
         AND horario_inicio = NEW.horario_inicio
         AND status = 'ativo';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.aluno_id IS NULL THEN
      UPDATE public.portal_fila_espera
         SET status = 'encerrado',
             updated_at = now()
       WHERE tipo = 'servico'
         AND agenda_servico_id = OLD.id
         AND status = 'ativo';
      RETURN OLD;
    END IF;

    IF OLD.data_especifica IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
          FROM public.agenda_servicos
         WHERE profissional_id = OLD.profissional_id
           AND data_especifica = OLD.data_especifica
           AND horario_inicio = OLD.horario_inicio
           AND aluno_id IS NOT NULL
      ) INTO _ainda_ocupado;

      IF NOT _ainda_ocupado THEN
        PERFORM public.fn_fila_espera_notificar_vaga(
          'servico', NULL, OLD.profissional_id, OLD.data_especifica, OLD.horario_inicio,
          'srv_del:' || OLD.id::text || ':' || gen_random_uuid()::text
        );
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fila_espera_agenda_servico ON public.agenda_servicos;
CREATE TRIGGER trg_fila_espera_agenda_servico
  AFTER INSERT OR DELETE ON public.agenda_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fila_espera_agenda_servico();
