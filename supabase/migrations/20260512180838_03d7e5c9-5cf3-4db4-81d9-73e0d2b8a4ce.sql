CREATE OR REPLACE FUNCTION public.trg_plano_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _has_contratado boolean;
BEGIN
  IF NEW.ativo = true THEN
    SELECT EXISTS(SELECT 1 FROM pipeline_stages WHERE name = 'Plano contratado' AND is_active = true) INTO _has_contratado;
    IF _has_contratado THEN
      PERFORM fn_move_pipeline(NEW.aluno_id, 'Plano contratado', 'auto_plano'::pipeline_movement_source,
                               'Plano criado: ' || NEW.tipo, NULL);
    END IF;
    PERFORM fn_move_pipeline(NEW.aluno_id, 'Aluno ativo', 'auto_plano'::pipeline_movement_source,
                             'Aluno ativado após contratação do plano.', NULL);
  END IF;
  RETURN NEW;
END;
$function$;