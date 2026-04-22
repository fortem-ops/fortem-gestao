
-- ============================================================
-- PIPELINE COMERCIAL (CRM FORTEM) — Schema MVP
-- ============================================================

-- Source enum for movements
CREATE TYPE public.pipeline_movement_source AS ENUM (
  'manual',
  'auto_avaliacao',
  'auto_plano',
  'auto_agenda',
  'auto_evasao',
  'auto_recuperacao'
);

-- ============================================================
-- 1) pipeline_stages
-- ============================================================
CREATE TABLE public.pipeline_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  position int NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stages"
  ON public.pipeline_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert stages"
  ON public.pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update stages"
  ON public.pipeline_stages FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete stages"
  ON public.pipeline_stages FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- Seed default stages
INSERT INTO public.pipeline_stages (name, position, color) VALUES
  ('Novo lead', 1, 'blue'),
  ('Contato realizado', 2, 'blue'),
  ('Avaliação agendada', 3, 'amber'),
  ('Avaliação confirmada', 4, 'amber'),
  ('Avaliação realizada', 5, 'amber'),
  ('Aula experimental agendada', 6, 'orange'),
  ('Aula experimental realizada', 7, 'orange'),
  ('Proposta enviada', 8, 'orange'),
  ('Plano contratado', 9, 'emerald'),
  ('Aluno ativo', 10, 'emerald'),
  ('Risco de evasão', 11, 'rose'),
  ('Aluno recuperado', 12, 'emerald'),
  ('Aluno perdido', 13, 'zinc');

-- ============================================================
-- 2) Add current_pipeline_stage_id to alunos
-- ============================================================
ALTER TABLE public.alunos
  ADD COLUMN current_pipeline_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX idx_alunos_pipeline_stage ON public.alunos(current_pipeline_stage_id);

-- ============================================================
-- 3) pipeline_movements (immutable history)
-- ============================================================
CREATE TABLE public.pipeline_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  moved_by_user_id uuid,
  moved_at timestamptz NOT NULL DEFAULT now(),
  time_in_previous_stage interval,
  notes text,
  source public.pipeline_movement_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_movements_aluno ON public.pipeline_movements(aluno_id);
CREATE INDEX idx_pipeline_movements_to_stage ON public.pipeline_movements(to_stage_id);
CREATE INDEX idx_pipeline_movements_moved_at ON public.pipeline_movements(moved_at DESC);

ALTER TABLE public.pipeline_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view movements"
  ON public.pipeline_movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert movements"
  ON public.pipeline_movements FOR INSERT TO authenticated
  WITH CHECK (moved_by_user_id IS NULL OR moved_by_user_id = auth.uid() OR is_coordinator_or_admin(auth.uid()));

-- No UPDATE / DELETE policies → immutable history

-- ============================================================
-- 4) pipeline_metadata (1:1 with aluno)
-- ============================================================
CREATE TABLE public.pipeline_metadata (
  aluno_id uuid NOT NULL PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  temperatura_lead text CHECK (temperatura_lead IN ('frio','morno','quente')),
  probabilidade_fechamento int CHECK (probabilidade_fechamento BETWEEN 0 AND 100),
  origem_lead text,
  valor_estimado_plano numeric(10,2),
  data_prevista_fechamento date,
  responsavel_comercial_id uuid,
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_metadata_responsavel ON public.pipeline_metadata(responsavel_comercial_id);
CREATE INDEX idx_pipeline_metadata_next_followup ON public.pipeline_metadata(next_followup_at);

ALTER TABLE public.pipeline_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view metadata"
  ON public.pipeline_metadata FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coord/admin or responsavel can insert metadata"
  ON public.pipeline_metadata FOR INSERT TO authenticated
  WITH CHECK (is_coordinator_or_admin(auth.uid()) OR responsavel_comercial_id = auth.uid());

CREATE POLICY "Coord/admin or responsavel can update metadata"
  ON public.pipeline_metadata FOR UPDATE TO authenticated
  USING (is_coordinator_or_admin(auth.uid()) OR responsavel_comercial_id = auth.uid());

CREATE POLICY "Admin can delete metadata"
  ON public.pipeline_metadata FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER trg_pipeline_metadata_updated_at
  BEFORE UPDATE ON public.pipeline_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) fn_move_pipeline (core function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_move_pipeline(
  _aluno_id uuid,
  _to_stage_name text,
  _source public.pipeline_movement_source DEFAULT 'manual',
  _notes text DEFAULT NULL,
  _moved_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _to_stage_id uuid;
  _from_stage_id uuid;
  _last_moved_at timestamptz;
  _time_in_prev interval;
  _movement_id uuid;
  _responsavel_tarefa uuid;
  _aluno_responsavel uuid;
  _meta_responsavel uuid;
BEGIN
  -- Resolve target stage
  SELECT id INTO _to_stage_id
  FROM pipeline_stages WHERE name = _to_stage_name AND is_active = true;

  IF _to_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline stage % not found', _to_stage_name;
  END IF;

  -- Current stage
  SELECT current_pipeline_stage_id, responsavel_id
    INTO _from_stage_id, _aluno_responsavel
  FROM alunos WHERE id = _aluno_id;

  -- No-op if already there
  IF _from_stage_id IS NOT NULL AND _from_stage_id = _to_stage_id THEN
    RETURN NULL;
  END IF;

  -- Time in previous stage (based on last movement to current stage)
  IF _from_stage_id IS NOT NULL THEN
    SELECT moved_at INTO _last_moved_at
    FROM pipeline_movements
    WHERE aluno_id = _aluno_id AND to_stage_id = _from_stage_id
    ORDER BY moved_at DESC LIMIT 1;

    IF _last_moved_at IS NOT NULL THEN
      _time_in_prev := now() - _last_moved_at;
    END IF;
  END IF;

  -- Insert movement
  INSERT INTO pipeline_movements (aluno_id, from_stage_id, to_stage_id, moved_by_user_id, time_in_previous_stage, notes, source)
  VALUES (_aluno_id, _from_stage_id, _to_stage_id, COALESCE(_moved_by, auth.uid()), _time_in_prev, _notes, _source)
  RETURNING id INTO _movement_id;

  -- Update aluno
  UPDATE alunos SET current_pipeline_stage_id = _to_stage_id, updated_at = now()
  WHERE id = _aluno_id;

  -- Resolve responsável for auto tasks
  SELECT responsavel_comercial_id INTO _meta_responsavel
  FROM pipeline_metadata WHERE aluno_id = _aluno_id;

  _responsavel_tarefa := COALESCE(_meta_responsavel, _aluno_responsavel, COALESCE(_moved_by, auth.uid()));

  -- Auto tasks (only when responsável is known)
  IF _responsavel_tarefa IS NOT NULL THEN
    IF _to_stage_name = 'Novo lead' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
      VALUES ('Realizar primeiro contato', 'Lead recém-criado no pipeline.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_novo_lead');
    ELSIF _to_stage_name = 'Avaliação agendada' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
      VALUES ('Confirmar presença na avaliação', 'Confirmar com o aluno antes da data marcada.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_avaliacao_agendada');
    ELSIF _to_stage_name = 'Proposta enviada' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
      VALUES ('Follow-up da proposta', 'Retomar contato 3 dias após envio da proposta.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '3 days', 'media', true, 'pipeline_proposta');
    ELSIF _to_stage_name = 'Risco de evasão' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto)
      VALUES ('Contato de retenção', 'Aluno em risco de evasão — entrar em contato.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_risco_evasao');
    END IF;
  END IF;

  RETURN _movement_id;
END;
$$;

-- ============================================================
-- 6) Trigger: avaliacoes → "Avaliação realizada"
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_avaliacao_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_stage text;
BEGIN
  SELECT s.name INTO _current_stage
  FROM alunos a LEFT JOIN pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  -- Always move to Avaliação realizada when an avaliação is registered (unless already past it)
  IF _current_stage IS NULL OR _current_stage IN ('Novo lead','Contato realizado','Avaliação agendada','Avaliação confirmada') THEN
    PERFORM fn_move_pipeline(NEW.aluno_id, 'Avaliação realizada', 'auto_avaliacao'::pipeline_movement_source,
                             'Movido automaticamente após registro de avaliação.', NEW.avaliador_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_avaliacoes_pipeline_after_insert
  AFTER INSERT ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_avaliacao_pipeline();

-- ============================================================
-- 7) Trigger: planos → "Aluno ativo"
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_plano_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo = true THEN
    PERFORM fn_move_pipeline(NEW.aluno_id, 'Plano contratado', 'auto_plano'::pipeline_movement_source,
                             'Plano criado: ' || NEW.tipo, NULL);
    PERFORM fn_move_pipeline(NEW.aluno_id, 'Aluno ativo', 'auto_plano'::pipeline_movement_source,
                             'Aluno ativado após contratação do plano.', NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_planos_pipeline_after_insert
  AFTER INSERT ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.trg_plano_pipeline();

-- ============================================================
-- 8) Trigger: agenda_servicos → Avaliação agendada / Aula experimental agendada
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_agenda_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_stage text;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.name INTO _current_stage
  FROM alunos a LEFT JOIN pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  IF NEW.atividade ILIKE '%avaliação%' OR NEW.atividade ILIKE '%avaliacao%' THEN
    IF _current_stage IS NULL OR _current_stage IN ('Novo lead','Contato realizado') THEN
      PERFORM fn_move_pipeline(NEW.aluno_id, 'Avaliação agendada', 'auto_agenda'::pipeline_movement_source,
                               'Avaliação agendada na agenda.', NEW.profissional_id);
    END IF;
  ELSIF NEW.atividade ILIKE '%experimental%' THEN
    IF _current_stage IS NULL OR _current_stage IN ('Novo lead','Contato realizado','Avaliação realizada') THEN
      PERFORM fn_move_pipeline(NEW.aluno_id, 'Aula experimental agendada', 'auto_agenda'::pipeline_movement_source,
                               'Aula experimental agendada.', NEW.profissional_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agenda_pipeline_after_insert
  AFTER INSERT ON public.agenda_servicos
  FOR EACH ROW EXECUTE FUNCTION public.trg_agenda_pipeline();

-- ============================================================
-- 9) fn_detect_evasao — manual + cron
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_detect_evasao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno record;
  _ativo_id uuid;
  _risco_id uuid;
  _recuperado_id uuid;
  _moved_to_risco int := 0;
  _moved_to_recuperado int := 0;
BEGIN
  SELECT id INTO _ativo_id FROM pipeline_stages WHERE name = 'Aluno ativo';
  SELECT id INTO _risco_id FROM pipeline_stages WHERE name = 'Risco de evasão';
  SELECT id INTO _recuperado_id FROM pipeline_stages WHERE name = 'Aluno recuperado';

  -- Move ativos → risco se sem agenda nos últimos 7 dias OU plano expirando em <15 dias
  FOR _aluno IN
    SELECT a.id
    FROM alunos a
    WHERE a.current_pipeline_stage_id = _ativo_id
      AND a.status = 'ativo'
      AND (
        NOT EXISTS (
          SELECT 1 FROM agenda_servicos ag
          WHERE ag.aluno_id = a.id
            AND COALESCE(ag.data_especifica, CURRENT_DATE) >= CURRENT_DATE - INTERVAL '7 days'
        )
        OR EXISTS (
          SELECT 1 FROM planos p
          WHERE p.aluno_id = a.id AND p.ativo = true
            AND p.data_fim IS NOT NULL
            AND p.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
        )
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Risco de evasão', 'auto_evasao'::pipeline_movement_source,
                             'Detectado automaticamente: sem agenda recente ou plano expirando.', NULL);
    _moved_to_risco := _moved_to_risco + 1;
  END LOOP;

  -- Move risco → recuperado se voltar a ter evento de agenda nos últimos 7 dias
  FOR _aluno IN
    SELECT a.id
    FROM alunos a
    WHERE a.current_pipeline_stage_id = _risco_id
      AND EXISTS (
        SELECT 1 FROM agenda_servicos ag
        WHERE ag.aluno_id = a.id
          AND COALESCE(ag.data_especifica, CURRENT_DATE) >= CURRENT_DATE - INTERVAL '7 days'
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno recuperado', 'auto_recuperacao'::pipeline_movement_source,
                             'Aluno voltou a ter atividade na agenda.', NULL);
    _moved_to_recuperado := _moved_to_recuperado + 1;
  END LOOP;

  RETURN jsonb_build_object('movidos_para_risco', _moved_to_risco, 'movidos_para_recuperado', _moved_to_recuperado);
END;
$$;

-- ============================================================
-- 10) pg_cron — daily evasão check at 03:00 UTC
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'pipeline-detect-evasao-daily',
  '0 3 * * *',
  $$ SELECT public.fn_detect_evasao(); $$
);
