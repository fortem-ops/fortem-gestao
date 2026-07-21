CREATE OR REPLACE FUNCTION public.alunos_block_self_sensitive_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_staff() OR public.is_coordinator_or_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     OR NEW.current_pipeline_stage_id IS DISTINCT FROM OLD.current_pipeline_stage_id
     OR NEW.frequencia_semanal IS DISTINCT FROM OLD.frequencia_semanal
     OR NEW.cpf IS DISTINCT FROM OLD.cpf
  THEN
    RAISE EXCEPTION 'Alunos não podem alterar campos sensíveis do próprio cadastro';
  END IF;

  RETURN NEW;
END;
$function$;