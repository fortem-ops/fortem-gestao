
-- ============================================================
-- Phase 3 — Cross-module sync triggers
-- ============================================================

-- 1) pipeline_movements -> alunos.current_pipeline_stage_id
CREATE OR REPLACE FUNCTION public.fn_sync_aluno_pipeline_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.alunos
     SET current_pipeline_stage_id = NEW.to_stage_id,
         updated_at = now()
   WHERE id = NEW.aluno_id
     AND (current_pipeline_stage_id IS DISTINCT FROM NEW.to_stage_id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_sync_aluno_pipeline_stage() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_sync_aluno_pipeline_stage ON public.pipeline_movements;
CREATE TRIGGER trg_sync_aluno_pipeline_stage
AFTER INSERT ON public.pipeline_movements
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_aluno_pipeline_stage();


-- 2) planos.ativo = false -> desativar creditos_aluno de origem 'plano'
CREATE OR REPLACE FUNCTION public.fn_sync_creditos_on_plano_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só age quando o plano foi efetivamente desativado
  IF (TG_OP = 'UPDATE'
      AND OLD.ativo = true
      AND NEW.ativo = false) THEN
    UPDATE public.creditos_aluno
       SET ativo = false,
           updated_at = now()
     WHERE aluno_id = NEW.aluno_id
       AND origem_tipo = 'plano'
       AND origem_id = NEW.id
       AND ativo = true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_sync_creditos_on_plano_change() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_sync_creditos_on_plano_change ON public.planos;
CREATE TRIGGER trg_sync_creditos_on_plano_change
AFTER UPDATE OF ativo ON public.planos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_creditos_on_plano_change();
