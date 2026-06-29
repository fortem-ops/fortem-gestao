
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

  SELECT s.position, s.funnel
    INTO _current_pos, _current_funnel
  FROM alunos a
  JOIN pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  SELECT position INTO _target_pos
  FROM pipeline_stages WHERE name = 'Treino experimental agendado' AND is_active = true;

  IF _target_pos IS NULL THEN RETURN NEW; END IF;

  IF _current_funnel = 'prospects' AND _current_pos IS NOT NULL AND _current_pos < _target_pos THEN
    PERFORM public.fn_move_pipeline(
      NEW.aluno_id,
      'Treino experimental agendado',
      'auto_agenda'::pipeline_movement_source,
      'Treino experimental agendado em ' || COALESCE(NEW.data_especifica::text, 'dia ' || NEW.dia_semana::text)
    );
  END IF;

  RETURN NEW;
END;
$$;
