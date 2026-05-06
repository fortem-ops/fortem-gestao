
CREATE OR REPLACE FUNCTION public.fn_auto_move_experimental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage_name text;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF NOT (NEW.atividade ILIKE '%experimental%' OR NEW.tipo ILIKE '%experimental%') THEN
    RETURN NEW;
  END IF;
  SELECT s.name INTO _stage_name
  FROM public.alunos a
  JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  IF _stage_name = 'Prospect' THEN
    PERFORM public.fn_move_pipeline(NEW.aluno_id, 'Treino experimental agendado', 'auto_agenda'::pipeline_movement_source, 'Treino experimental agendado', NEW.profissional_id);
  END IF;
  RETURN NEW;
END;
$$;
