ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS hora_limite time;

-- 1) Cria tarefa ao agendar Reabilitação
CREATE OR REPLACE FUNCTION public.fn_tarefa_reabilitacao_agendada()
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
  IF COALESCE(NEW.atividade,'') NOT ILIKE '%reabilita%' THEN RETURN NEW; END IF;

  _data := COALESCE(NEW.data_especifica, CURRENT_DATE);
  SELECT responsavel_id, nome INTO _resp, _nome FROM public.alunos WHERE id = NEW.aluno_id;
  _resp := COALESCE(NEW.profissional_id, _resp);
  IF _resp IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tarefas
    WHERE aluno_id = NEW.aluno_id
      AND tipo_auto = 'relatorio_reabilitacao'
      AND status <> 'concluida'
      AND data_limite = _data
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tarefas (
    titulo, descricao, aluno_id, responsavel_id, criado_por_id,
    prioridade, status, data_limite, hora_limite, automatica, tipo_auto
  ) VALUES (
    'Realizar relatório de evolução — Reabilitação',
    'Atendimento de reabilitação em ' || to_char(_data, 'DD/MM/YYYY') ||
      CASE WHEN _nome IS NOT NULL THEN ' — ' || _nome ELSE '' END ||
      '. Registre a nova sessão no relatório de Evolução.',
    NEW.aluno_id, _resp, _resp,
    'media', 'pendente', _data, NEW.horario_fim, true, 'relatorio_reabilitacao'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_reabilitacao_agendada ON public.agenda_servicos;
CREATE TRIGGER trg_tarefa_reabilitacao_agendada
AFTER INSERT ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_reabilitacao_agendada();

-- 2) Remove tarefa aberta quando o agendamento é excluído (acrescenta ramo reabilitação)
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
  ELSIF COALESCE(OLD.atividade,'') ILIKE '%reabilita%' THEN
    DELETE FROM public.tarefas
    WHERE aluno_id = OLD.aluno_id
      AND tipo_auto = 'relatorio_reabilitacao'
      AND status <> 'concluida'
      AND data_limite = OLD.data_especifica;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_agenda_removida ON public.agenda_servicos;
CREATE TRIGGER trg_tarefa_agenda_removida
AFTER DELETE ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_agenda_removida();

-- 3) Conclui a tarefa quando uma nova sessão de evolução é finalizada
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefas_por_reabilitacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _novas int := 0;
  _antigas int := 0;
  _alvo uuid;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF lower(COALESCE(NEW.tipo,'')) NOT LIKE '%reabilita%' THEN RETURN NEW; END IF;

  SELECT count(*) INTO _novas
  FROM jsonb_array_elements(COALESCE(NEW.dados->'sessoes', '[]'::jsonb)) s
  WHERE COALESCE(s->>'finalizado_em', '') <> '';

  IF TG_OP = 'UPDATE' THEN
    SELECT count(*) INTO _antigas
    FROM jsonb_array_elements(COALESCE(OLD.dados->'sessoes', '[]'::jsonb)) s
    WHERE COALESCE(s->>'finalizado_em', '') <> '';
  END IF;

  IF _novas <= _antigas THEN RETURN NEW; END IF;

  SELECT id INTO _alvo
  FROM public.tarefas
  WHERE aluno_id = NEW.aluno_id
    AND tipo_auto = 'relatorio_reabilitacao'
    AND status <> 'concluida'
  ORDER BY (data_limite > CURRENT_DATE), data_limite NULLS LAST, created_at
  LIMIT 1;

  IF _alvo IS NOT NULL THEN
    DELETE FROM public.tarefas WHERE id = _alvo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concluir_tarefas_por_reabilitacao ON public.avaliacoes;
CREATE TRIGGER trg_concluir_tarefas_por_reabilitacao
AFTER INSERT OR UPDATE OF dados ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_concluir_tarefas_por_reabilitacao();