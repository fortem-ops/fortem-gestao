
-- 1) Restrict clube_config read to staff only
DROP POLICY IF EXISTS "aluno_read_clube_config" ON public.clube_config;

-- 2) Add trigger to block students from updating sensitive fields on their own alunos row
CREATE OR REPLACE FUNCTION public.alunos_block_self_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the actor is the student themselves (not staff)
  IF public.is_staff() OR public.is_coordinator_or_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     OR NEW.current_pipeline_stage_id IS DISTINCT FROM OLD.current_pipeline_stage_id
     OR NEW.frequencia_semanal IS DISTINCT FROM OLD.frequencia_semanal
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.cpf IS DISTINCT FROM OLD.cpf
     OR NEW.data_matricula IS DISTINCT FROM OLD.data_matricula
     OR NEW.data_encerramento IS DISTINCT FROM OLD.data_encerramento
     OR NEW.motivo_encerramento IS DISTINCT FROM OLD.motivo_encerramento
  THEN
    RAISE EXCEPTION 'Alunos não podem alterar campos sensíveis do próprio cadastro';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_block_self_sensitive_updates ON public.alunos;
CREATE TRIGGER trg_alunos_block_self_sensitive_updates
BEFORE UPDATE ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.alunos_block_self_sensitive_updates();
