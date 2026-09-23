CREATE OR REPLACE FUNCTION public.trg_avaliacao_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_stage text;
  _status text;
BEGIN
  SELECT a.status, s.name INTO _status, _current_stage
  FROM alunos a LEFT JOIN pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  -- Clientes avulsos ficam fora do funil comercial
  IF _status = 'avulso' THEN
    RETURN NEW;
  END IF;

  -- Etapa de destino precisa existir e estar ativa
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages WHERE name = 'Avaliação realizada' AND is_active = true
  ) THEN
    RETURN NEW;
  END IF;

  IF _current_stage IS NULL OR _current_stage IN ('Novo lead','Contato realizado','Avaliação agendada','Avaliação confirmada') THEN
    PERFORM fn_move_pipeline(NEW.aluno_id, 'Avaliação realizada', 'auto_avaliacao'::pipeline_movement_source,
                             'Movido automaticamente após registro de avaliação.', NEW.avaliador_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_agenda_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_stage text;
  _status text;
  _target text;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;

  SELECT a.status, s.name INTO _status, _current_stage
  FROM alunos a LEFT JOIN pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  IF _status = 'avulso' THEN
    RETURN NEW;
  END IF;

  IF NEW.atividade ILIKE '%avaliação%' OR NEW.atividade ILIKE '%avaliacao%' THEN
    IF _current_stage IS NULL OR _current_stage IN ('Novo lead','Contato realizado') THEN
      _target := 'Avaliação agendada';
    END IF;
  ELSIF NEW.atividade ILIKE '%experimental%' THEN
    IF _current_stage IS NULL OR _current_stage IN ('Novo lead','Contato realizado','Avaliação realizada') THEN
      _target := 'Treino experimental agendado';
    END IF;
  END IF;

  IF _target IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages WHERE name = _target AND is_active = true
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM fn_move_pipeline(NEW.aluno_id, _target, 'auto_agenda'::pipeline_movement_source,
                           CASE WHEN _target = 'Avaliação agendada'
                                THEN 'Avaliação agendada na agenda.'
                                ELSE 'Treino experimental agendado.' END,
                           NEW.profissional_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_auto_move_experimental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _stage_name text;
  _status text;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF NOT (NEW.atividade ILIKE '%experimental%' OR NEW.tipo ILIKE '%experimental%') THEN
    RETURN NEW;
  END IF;

  SELECT a.status, s.name INTO _status, _stage_name
  FROM public.alunos a
  LEFT JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  IF _status = 'avulso' THEN RETURN NEW; END IF;

  IF _stage_name = 'Prospect'
     AND EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Treino experimental agendado' AND is_active = true) THEN
    PERFORM public.fn_move_pipeline(NEW.aluno_id, 'Treino experimental agendado', 'auto_agenda'::pipeline_movement_source, 'Treino experimental agendado', NEW.profissional_id);
  END IF;
  RETURN NEW;
END;
$function$;