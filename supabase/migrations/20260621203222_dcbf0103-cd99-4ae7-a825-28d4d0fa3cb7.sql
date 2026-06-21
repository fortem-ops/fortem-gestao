-- ============================================================
-- MIGRAÇÃO 6 — AUDITORIA, RETENÇÃO E LIMPEZA DE POLICIES
-- Fortem Gestão · 2026-06-21
-- ============================================================

-- A. TRIGGER DE AUDITORIA EM notificacoes
DROP TRIGGER IF EXISTS trg_audit_notificacoes ON public.notificacoes;
CREATE TRIGGER trg_audit_notificacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

COMMENT ON TABLE public.notificacoes IS
  'Notificações internas entre equipe e alunos. '
  'Auditado por trg_audit_notificacoes desde 2026-06-21.';

-- B. RETENÇÃO AUTOMÁTICA: audit_log — 5 anos (Art. 37 LGPD)
SELECT cron.unschedule('audit-log-cleanup-5anos')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'audit-log-cleanup-5anos'
);

SELECT cron.schedule(
  'audit-log-cleanup-5anos',
  '0 3 1 * *',
  $$
    DELETE FROM public.audit_log
    WHERE created_at < now() - interval '5 years';
  $$
);

COMMENT ON TABLE public.audit_log IS
  'Registro de auditoria de alterações em dados sensíveis. '
  'Retido por 5 anos conforme Art. 37 LGPD. '
  'Limpeza automática via pg_cron job audit-log-cleanup-5anos '
  '(executa às 03:00 do dia 1 de cada mês). '
  'Contém dados_antes/dados_depois em JSONB para rastreabilidade completa.';

-- C. LIMPEZA DE POLICIES LEGADAS EM alunos
DROP POLICY IF EXISTS "Admin can delete alunos"                    ON public.alunos;
DROP POLICY IF EXISTS "Admin can insert alunos"                    ON public.alunos;
DROP POLICY IF EXISTS "Admin can update alunos"                    ON public.alunos;
DROP POLICY IF EXISTS "Coordenadores podem atualizar alunos"       ON public.alunos;
DROP POLICY IF EXISTS "Staff can insert alunos"                    ON public.alunos;
DROP POLICY IF EXISTS "Staff can update alunos"                    ON public.alunos;
DROP POLICY IF EXISTS "Staff or owner can view alunos"             ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_delete"                        ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_select"                        ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_update"                        ON public.alunos;
DROP POLICY IF EXISTS "alunos_admin_insert"                        ON public.alunos;
DROP POLICY IF EXISTS "alunos_admin_delete"                        ON public.alunos;
DROP POLICY IF EXISTS "alunos_self_select"                         ON public.alunos;
DROP POLICY IF EXISTS "alunos_self_update"                         ON public.alunos;

CREATE POLICY "alunos_admin_all"
  ON public.alunos FOR ALL
  USING  (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

CREATE POLICY "alunos_coord_select"
  ON public.alunos FOR SELECT
  USING (public.is_coordenador_ou_admin());

CREATE POLICY "alunos_coord_update"
  ON public.alunos FOR UPDATE
  USING (public.is_coordenador_ou_admin());

CREATE POLICY "alunos_staff_select"
  ON public.alunos FOR SELECT
  USING (public.is_professor_staff());

CREATE POLICY "alunos_self_select"
  ON public.alunos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "alunos_self_update"
  ON public.alunos FOR UPDATE
  USING (user_id = auth.uid());

-- VERIFICAÇÃO INLINE
DO $$
DECLARE
  v_alunos      int;
  v_legal       int;
  v_notif_trg   int;
  v_cron_job    int;
BEGIN
  SELECT COUNT(*) INTO v_alunos
  FROM pg_policies WHERE schemaname='public' AND tablename='alunos';

  SELECT COUNT(*) INTO v_legal
  FROM pg_policies WHERE schemaname='public' AND tablename='legal_annexes';

  SELECT COUNT(*) INTO v_notif_trg
  FROM information_schema.triggers
  WHERE trigger_schema='public'
    AND event_object_table='notificacoes'
    AND trigger_name='trg_audit_notificacoes';

  SELECT COUNT(*) INTO v_cron_job
  FROM cron.job WHERE jobname='audit-log-cleanup-5anos';

  RAISE NOTICE '=== VERIFICAÇÃO ===';
  RAISE NOTICE 'alunos policies: % (esperado: 6)', v_alunos;
  RAISE NOTICE 'legal_annexes policies: % (esperado: 4)', v_legal;
  RAISE NOTICE 'trg_audit_notificacoes: % (esperado: 1)', v_notif_trg;
  RAISE NOTICE 'cron job audit-log-cleanup-5anos: % (esperado: 1)', v_cron_job;

  IF v_alunos <> 6 THEN
    RAISE WARNING 'alunos: contagem inesperada de policies: %', v_alunos;
  END IF;
  IF v_legal <> 4 THEN
    RAISE WARNING 'legal_annexes: contagem inesperada de policies: %', v_legal;
  END IF;
  IF v_notif_trg = 0 THEN
    RAISE WARNING 'trigger trg_audit_notificacoes não encontrado!';
  END IF;
  IF v_cron_job = 0 THEN
    RAISE WARNING 'cron job não encontrado!';
  END IF;
END;
$$;