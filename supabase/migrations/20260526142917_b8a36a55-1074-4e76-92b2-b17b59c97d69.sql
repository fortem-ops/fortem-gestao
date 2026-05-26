CREATE OR REPLACE FUNCTION public.trigger_presenca_experimental_to_prospect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aluno_id uuid;
  v_atividade text;
  v_current_stage uuid;
  v_prospect_stage uuid;
  v_experimental_stage uuid;
BEGIN
  IF NEW.comparecimento IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT aluno_id, atividade INTO v_aluno_id, v_atividade
  FROM public.agenda_servicos WHERE id = NEW.agenda_id;

  IF v_aluno_id IS NULL OR v_atividade IS NULL THEN RETURN NEW; END IF;
  IF v_atividade NOT ILIKE 'Treino Experimental%' THEN RETURN NEW; END IF;

  SELECT id INTO v_prospect_stage FROM public.pipeline_stages WHERE name = 'Prospect' LIMIT 1;
  SELECT id INTO v_experimental_stage FROM public.pipeline_stages WHERE name = 'Treino experimental agendado' LIMIT 1;

  SELECT current_pipeline_stage_id INTO v_current_stage FROM public.alunos WHERE id = v_aluno_id;

  IF v_current_stage = v_experimental_stage AND v_prospect_stage IS NOT NULL THEN
    UPDATE public.alunos SET current_pipeline_stage_id = v_prospect_stage WHERE id = v_aluno_id;
    INSERT INTO public.pipeline_movements (aluno_id, from_stage_id, to_stage_id, source, notes)
    VALUES (v_aluno_id, v_experimental_stage, v_prospect_stage, 'auto_agenda', 'Presença confirmada no Treino Experimental');
  END IF;

  RETURN NEW;
END;
$function$;