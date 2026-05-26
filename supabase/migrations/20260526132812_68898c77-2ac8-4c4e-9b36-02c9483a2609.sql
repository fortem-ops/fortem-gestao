
ALTER VIEW public.v_servicos_agenda SET (security_invoker = on);

DROP POLICY IF EXISTS "Auth users inserem system_logs" ON public.system_logs;
CREATE POLICY "Auth users inserem system_logs"
  ON public.system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
