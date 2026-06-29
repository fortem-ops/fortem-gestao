
CREATE OR REPLACE FUNCTION public.fn_pipeline_auto_mover_treino_agendado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_pos int;
  _target_pos int;
  _current_funnel text;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.atividade IS DISTINCT FROM 'Treino Experimental' THEN RETURN NEW; END IF;

  -- Posição atual do aluno
  SELECT s.position, s.funnel
    INTO _current_pos, _current_funnel
  FROM alunos a
  JOIN pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  -- Posição alvo
  SELECT position INTO _target_pos
  FROM pipeline_stages WHERE name = 'Treino experimental agendado' AND is_active = true;

  IF _target_pos IS NULL THEN RETURN NEW; END IF;

  -- Só move se estiver no funil prospects e antes da etapa alvo
  IF _current_funnel = 'prospects' AND _current_pos IS NOT NULL AND _current_pos < _target_pos THEN
    PERFORM public.fn_move_pipeline(
      NEW.aluno_id,
      'Treino experimental agendado',
      'auto'::pipeline_movement_source,
      'Treino experimental agendado em ' || COALESCE(NEW.data_especifica::text, 'dia ' || NEW.dia_semana::text)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_mover_treino_agendado ON public.agenda_servicos;

CREATE TRIGGER trg_auto_mover_treino_agendado
AFTER INSERT OR UPDATE OF atividade, aluno_id
ON public.agenda_servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_pipeline_auto_mover_treino_agendado();
