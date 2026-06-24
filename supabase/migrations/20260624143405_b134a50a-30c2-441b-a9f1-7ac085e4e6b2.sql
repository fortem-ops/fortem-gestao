-- ============================================================
-- MÓDULO FINANCEIRO — AJUSTES PÓS-CRIAÇÃO
-- Fortem Gestão · 2026-06-24
-- ============================================================

-- A. Trigger de auditoria em ciclos_credito
DROP TRIGGER IF EXISTS trg_audit_ciclos_credito ON public.ciclos_credito;
CREATE TRIGGER trg_audit_ciclos_credito
  AFTER INSERT OR UPDATE OR DELETE ON public.ciclos_credito
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- B. Coluna observacoes em contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS observacoes text;

COMMENT ON COLUMN public.contratos.observacoes IS
  'Campo livre para anotações do admin/coord sobre o contrato.';

-- C. Verificação e criação do trigger updated_at em contratos se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'contratos'
      AND trigger_name = 'trg_contratos_updated_at'
  ) THEN
    CREATE TRIGGER trg_contratos_updated_at
      BEFORE UPDATE ON public.contratos
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
    RAISE NOTICE 'trg_contratos_updated_at criado';
  ELSE
    RAISE NOTICE 'trg_contratos_updated_at já existe';
  END IF;
END; $$;

-- D. Verificação final
DO $$
DECLARE
  v_triggers int;
  v_obs_col  int;
BEGIN
  SELECT COUNT(*) INTO v_triggers
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND event_object_table = 'ciclos_credito'
    AND trigger_name = 'trg_audit_ciclos_credito';

  SELECT COUNT(*) INTO v_obs_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'contratos'
    AND column_name = 'observacoes';

  RAISE NOTICE '=== AJUSTES MÓDULO FINANCEIRO ===';
  RAISE NOTICE 'trg_audit_ciclos_credito: % (esperado: 1)', v_triggers;
  RAISE NOTICE 'contratos.observacoes: % (esperado: 1)', v_obs_col;
  RAISE NOTICE 'Migração 2/3 concluída.';
END; $$;