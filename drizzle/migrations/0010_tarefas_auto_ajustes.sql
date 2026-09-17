-- 1) fn_move_pipeline: remove criação da tarefa de Contato de retenção
CREATE OR REPLACE FUNCTION public.fn_move_pipeline(_aluno_id uuid, _to_stage_name text, _source pipeline_movement_source DEFAULT 'manual'::pipeline_movement_source, _notes text DEFAULT NULL::text, _moved_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT id INTO _to_stage_id
  FROM pipeline_stages WHERE name = _to_stage_name AND is_active = true;

  IF _to_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline stage % not found', _to_stage_name;
  END IF;

  SELECT current_pipeline_stage_id, responsavel_id
    INTO _from_stage_id, _aluno_responsavel
  FROM alunos WHERE id = _aluno_id;

  IF _from_stage_id IS NOT NULL AND _from_stage_id = _to_stage_id THEN
    RETURN NULL;
  END IF;

  IF _from_stage_id IS NOT NULL THEN
    SELECT moved_at INTO _last_moved_at
    FROM pipeline_movements
    WHERE aluno_id = _aluno_id AND to_stage_id = _from_stage_id
    ORDER BY moved_at DESC LIMIT 1;

    IF _last_moved_at IS NOT NULL THEN
      _time_in_prev := now() - _last_moved_at;
    END IF;
  END IF;

  INSERT INTO pipeline_movements (aluno_id, from_stage_id, to_stage_id, moved_by_user_id, time_in_previous_stage, notes, source)
  VALUES (_aluno_id, _from_stage_id, _to_stage_id, COALESCE(_moved_by, auth.uid()), _time_in_prev, _notes, _source)
  RETURNING id INTO _movement_id;

  UPDATE alunos SET current_pipeline_stage_id = _to_stage_id, updated_at = now()
  WHERE id = _aluno_id;

  SELECT responsavel_comercial_id INTO _meta_responsavel
  FROM pipeline_metadata WHERE aluno_id = _aluno_id;

  _responsavel_tarefa := COALESCE(_meta_responsavel, _aluno_responsavel, COALESCE(_moved_by, auth.uid()));

  IF _responsavel_tarefa IS NOT NULL THEN
    IF _to_stage_name = 'Novo lead' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto, tipo_atividade)
      VALUES ('Realizar primeiro contato', 'Lead recém-criado no pipeline.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_novo_lead', 'ligacao');
    ELSIF _to_stage_name = 'Avaliação agendada' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto, tipo_atividade)
      VALUES ('Confirmar presença na avaliação', 'Confirmar com o aluno antes da data marcada.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '1 day', 'alta', true, 'pipeline_avaliacao_agendada', 'whatsapp');
    ELSIF _to_stage_name = 'Proposta enviada' THEN
      INSERT INTO tarefas (titulo, descricao, aluno_id, responsavel_id, criado_por_id, data_limite, prioridade, automatica, tipo_auto, tipo_atividade)
      VALUES ('Follow-up da proposta', 'Retomar contato 3 dias após envio da proposta.', _aluno_id, _responsavel_tarefa, _responsavel_tarefa,
              CURRENT_DATE + INTERVAL '3 days', 'media', true, 'pipeline_proposta', 'ligacao');
    END IF;
  END IF;

  RETURN _movement_id;
END;
$function$;

-- 2) fn_detect_evasao: remove o bloco Ativo -> Risco de evasão
CREATE OR REPLACE FUNCTION public.fn_detect_evasao()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno record;
  _ativo_id uuid;
  _risco_id uuid;
  _renov_id uuid;
  _inativo_id uuid;
  _moved_to_risco int := 0;
  _moved_to_renov int := 0;
  _moved_to_inativo int := 0;
  _moved_to_ativo int := 0;
BEGIN
  SELECT id INTO _ativo_id FROM pipeline_stages WHERE name = 'Aluno ativo';
  SELECT id INTO _risco_id FROM pipeline_stages WHERE name = 'Risco de evasão';
  SELECT id INTO _renov_id FROM pipeline_stages WHERE name = 'Renovação de plano';
  SELECT id INTO _inativo_id FROM pipeline_stages WHERE name = 'Aluno inativo';

  FOR _aluno IN
    SELECT a.id FROM alunos a
    JOIN pipeline_stages ps ON ps.id = a.current_pipeline_stage_id
    JOIN pipeline_funnels pf ON pf.id = ps.funnel_id
    WHERE pf.slug = 'inativo'
      AND a.status NOT IN ('lead','prospect')
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND (
            p.data_fim IS NULL
            OR p.data_fim >= CURRENT_DATE
            OR LOWER(COALESCE(p.tipo,'')) ~ '(start|gympass|wellhub|total ?pass)'
          )
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno ativo', 'auto_evasao'::pipeline_movement_source,
                             'Aluno reativado: plano ativo detectado.', NULL);
    _moved_to_ativo := _moved_to_ativo + 1;
  END LOOP;

  -- (pausado) Ativo -> Risco de evasão: depende da frequência de alunos

  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id IN (_ativo_id, _risco_id)
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND p.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
          AND LOWER(COALESCE(p.tipo,'')) !~ '(start|gympass|wellhub|total ?pass)'
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Renovação de plano', 'auto_evasao'::pipeline_movement_source,
                             'Plano expira em até 15 dias.', NULL);
    _moved_to_renov := _moved_to_renov + 1;
  END LOOP;

  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id = _risco_id
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND LOWER(COALESCE(p.tipo,'')) ~ '(start|gympass|wellhub|total ?pass)'
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno ativo', 'auto_evasao'::pipeline_movement_source,
                             'Plano de renovação automática ativo.', NULL);
    _moved_to_ativo := _moved_to_ativo + 1;
  END LOOP;

  FOR _aluno IN
    SELECT a.id FROM alunos a
    JOIN pipeline_stages ps ON ps.id = a.current_pipeline_stage_id
    JOIN pipeline_funnels pf ON pf.id = ps.funnel_id
    WHERE pf.slug = 'aluno'
      AND a.status NOT IN ('lead','prospect')
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND (
            p.data_fim IS NULL
            OR p.data_fim >= CURRENT_DATE
            OR LOWER(COALESCE(p.tipo,'')) ~ '(start|gympass|wellhub|total ?pass)'
          )
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno inativo', 'auto_evasao'::pipeline_movement_source,
                             'Sem plano ativo vigente.', NULL);
    _moved_to_inativo := _moved_to_inativo + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'movidos_para_risco', _moved_to_risco,
    'movidos_para_renovacao', _moved_to_renov,
    'movidos_para_inativo', _moved_to_inativo,
    'movidos_para_recuperado', _moved_to_ativo
  );
END;
$function$;

-- 3) reavaliação funcional: aceitar responsável admin
CREATE OR REPLACE FUNCTION public.fn_resolver_responsavel_reavaliacao(_aluno_id uuid, _fallback uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp uuid;
BEGIN
  SELECT responsavel_id INTO _resp FROM public.alunos WHERE id = _aluno_id;
  RETURN COALESCE(_resp, _fallback);
END;
$$;

-- 4) fn_criar_tarefa_reavaliacao: prazo/prioridade conforme regra de Alunos Ativos
CREATE OR REPLACE FUNCTION public.fn_criar_tarefa_reavaliacao(
  _aluno_id uuid,
  _data_ultima date,
  _criado_por uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _responsavel uuid;
  _criador uuid;
  _aluno_nome text;
  _existente uuid;
  _nova_id uuid;
  _data_limite date;
  _prioridade text;
BEGIN
  _responsavel := public.fn_resolver_responsavel_reavaliacao(_aluno_id, _criado_por);
  IF _responsavel IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _existente
  FROM public.tarefas
  WHERE aluno_id = _aluno_id
    AND tipo_auto = 'reavaliacao_funcional'
    AND status = 'pendente'
  LIMIT 1;

  IF _existente IS NOT NULL THEN
    RETURN _existente;
  END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = _aluno_id;
  _criador := COALESCE(_criado_por, _responsavel);

  IF _data_ultima IS NULL THEN
    _data_limite := CURRENT_DATE - 1;
  ELSE
    _data_limite := (_data_ultima + INTERVAL '4 months')::date;
  END IF;
  _prioridade := CASE WHEN _data_limite < CURRENT_DATE THEN 'alta' ELSE 'media' END;

  INSERT INTO public.tarefas (
    titulo, descricao, aluno_id, responsavel_id, criado_por_id,
    prioridade, status, data_limite, automatica, tipo_auto
  ) VALUES (
    'Agendar reavaliação funcional',
    CASE
      WHEN _data_ultima IS NULL THEN
        'Aluno ' || COALESCE(_aluno_nome, '') || ' sem avaliação funcional registrada. Agende uma nova avaliação.'
      ELSE
        'Última avaliação funcional realizada em ' || to_char(_data_ultima, 'DD/MM/YYYY') || '. Agende uma nova avaliação.'
    END,
    _aluno_id, _responsavel, _criador,
    _prioridade, 'pendente', _data_limite, true, 'reavaliacao_funcional'
  )
  RETURNING id INTO _nova_id;

  RETURN _nova_id;
END;
$$;

-- 5) Tarefa ao agendar avaliação funcional
CREATE OR REPLACE FUNCTION public.fn_tarefa_avaliacao_funcional_agendada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resp uuid;
  _nome text;
  _data date;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.atividade,'') NOT ILIKE '%funcional%' THEN RETURN NEW; END IF;

  _data := COALESCE(NEW.data_especifica, CURRENT_DATE);
  SELECT responsavel_id, nome INTO _resp, _nome FROM public.alunos WHERE id = NEW.aluno_id;
  _resp := COALESCE(NEW.profissional_id, _resp);
  IF _resp IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'avaliacao_funcional_agendada'
      AND status <> 'concluida'
      AND data_limite = _data
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tarefas (
    titulo, descricao, aluno_id, responsavel_id, criado_por_id,
    prioridade, status, data_limite, automatica, tipo_auto
  ) VALUES (
    'Realizar avaliação funcional',
    'Avaliação funcional agendada para ' || to_char(_data, 'DD/MM/YYYY') ||
      CASE WHEN _nome IS NOT NULL THEN ' — ' || _nome ELSE '' END || '.',
    NEW.aluno_id, _resp, _resp,
    'media', 'pendente', _data, true, 'avaliacao_funcional_agendada'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_avaliacao_funcional_agendada ON public.agenda_servicos;
CREATE TRIGGER trg_tarefa_avaliacao_funcional_agendada
AFTER INSERT ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_avaliacao_funcional_agendada();

-- 6) Remove tarefa aberta quando o agendamento é excluído
CREATE OR REPLACE FUNCTION public.fn_tarefa_agenda_removida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.aluno_id IS NULL THEN RETURN OLD; END IF;

  IF COALESCE(OLD.atividade,'') ILIKE '%funcional%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = OLD.aluno_id
      AND tipo_auto = 'avaliacao_funcional_agendada'
      AND status <> 'concluida'
      AND data_limite = OLD.data_especifica;
  ELSIF COALESCE(OLD.atividade,'') ILIKE '%experimental%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = OLD.aluno_id
      AND tipo_auto = 'relatorio_experimental'
      AND status <> 'concluida'
      AND data_limite = OLD.data_especifica + 1;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_agenda_removida ON public.agenda_servicos;
CREATE TRIGGER trg_tarefa_agenda_removida
AFTER DELETE ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_agenda_removida();

-- 7) Tarefas de relatório de treino experimental já ocorrido
CREATE OR REPLACE FUNCTION public.fn_gerar_tarefas_pos_experimental()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ag record;
  _resp uuid;
  _nome text;
  _criadas int := 0;
BEGIN
  FOR _ag IN
    SELECT ag.id, ag.aluno_id, ag.profissional_id, ag.data_especifica
    FROM public.agenda_servicos ag
    WHERE ag.aluno_id IS NOT NULL
      AND ag.atividade ILIKE '%experimental%'
      AND ag.data_especifica IS NOT NULL
      AND ag.data_especifica >= CURRENT_DATE - INTERVAL '60 days'
      AND (
        ag.data_especifica < CURRENT_DATE
        OR (ag.data_especifica = CURRENT_DATE AND COALESCE(ag.horario_fim, '23:59'::time) < (now() AT TIME ZONE 'America/Sao_Paulo')::time)
      )
  LOOP
    -- relatório experimental já registrado após o treino?
    IF EXISTS (
      SELECT 1 FROM public.avaliacoes av
      WHERE av.aluno_id = _ag.aluno_id
        AND lower(COALESCE(av.tipo,'')) LIKE '%experimental%'
        AND av.data >= _ag.data_especifica
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.aluno_id = _ag.aluno_id
        AND t.tipo_auto = 'relatorio_experimental'
        AND t.data_limite = _ag.data_especifica + 1
    ) THEN
      CONTINUE;
    END IF;

    SELECT responsavel_id, nome INTO _resp, _nome FROM public.alunos WHERE id = _ag.aluno_id;
    _resp := COALESCE(_ag.profissional_id, _resp);
    IF _resp IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.tarefas (
      titulo, descricao, aluno_id, responsavel_id, criado_por_id,
      prioridade, status, data_limite, automatica, tipo_auto
    ) VALUES (
      'Realizar relatório do treino experimental',
      'Treino experimental realizado em ' || to_char(_ag.data_especifica, 'DD/MM/YYYY') ||
        CASE WHEN _nome IS NOT NULL THEN ' — ' || _nome ELSE '' END || '. Preencha o relatório experimental.',
      _ag.aluno_id, _resp, _resp,
      'alta', 'pendente', (_ag.data_especifica + 1), true, 'relatorio_experimental'
    );
    _criadas := _criadas + 1;
  END LOOP;

  RETURN jsonb_build_object('tarefas_criadas', _criadas, 'executado_em', now());
END;
$$;

-- 8) Conclui automaticamente as tarefas quando a avaliação é registrada
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefas_por_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;

  IF lower(COALESCE(NEW.tipo,'')) LIKE '%funcional%' THEN
    UPDATE public.tarefas SET status = 'concluida', updated_at = now()
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'avaliacao_funcional_agendada'
      AND status <> 'concluida';
  ELSIF lower(COALESCE(NEW.tipo,'')) LIKE '%experimental%' THEN
    UPDATE public.tarefas SET status = 'concluida', updated_at = now()
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'relatorio_experimental'
      AND status <> 'concluida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concluir_tarefas_por_avaliacao ON public.avaliacoes;
CREATE TRIGGER trg_concluir_tarefas_por_avaliacao
AFTER INSERT ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_concluir_tarefas_por_avaliacao();
