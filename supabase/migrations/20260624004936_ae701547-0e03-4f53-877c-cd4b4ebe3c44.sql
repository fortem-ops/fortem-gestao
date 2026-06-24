-- 1. Audit trigger em webhook_events_rede
DROP TRIGGER IF EXISTS trg_audit_webhook_events_rede ON public.webhook_events_rede;
CREATE TRIGGER trg_audit_webhook_events_rede
  AFTER INSERT OR UPDATE OR DELETE ON public.webhook_events_rede
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- 2. Policy de leitura admin em inter_tokens
DROP POLICY IF EXISTS "inter_tokens_admin_select" ON public.inter_tokens;
CREATE POLICY "inter_tokens_admin_select"
  ON public.inter_tokens FOR SELECT
  TO authenticated
  USING (public.is_admin_role());

-- 3. pg_cron jobs (LGPD + rate-limit cleanup)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit-log-cleanup-5anos') THEN
    PERFORM cron.schedule(
      'audit-log-cleanup-5anos',
      '0 3 1 * *',
      $job$DELETE FROM public.audit_log WHERE created_at < now() - interval '5 years'$job$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-rede-cleanup') THEN
    PERFORM cron.schedule(
      'rate-limit-rede-cleanup',
      '*/30 * * * *',
      $job$DELETE FROM public.rate_limit_cobrancas WHERE janela_min < EXTRACT(EPOCH FROM now())::bigint/60 - 60$job$
    );
  END IF;
END;
$mig$;