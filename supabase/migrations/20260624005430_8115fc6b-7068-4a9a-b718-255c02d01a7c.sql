-- CATEGORIA 1: search_path em fn_set_updated_at
ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;

-- CATEGORIA 3: Revogar EXECUTE público de SECURITY DEFINER, exceto whitelist
DO $mig$
DECLARE
  func_sig text;
  keep_names text[] := ARRAY[
    'is_admin','is_coordinator_or_admin','is_staff','is_admin_role',
    'is_coordenador_ou_admin','is_professor_staff','has_role',
    'fn_check_rate_limit','fn_lgpd_relatorio_titular','fn_lgpd_anonimizar_titular',
    'fn_lookup_aluno_por_cpf_hash'
  ];
BEGIN
  FOR func_sig IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname <> ALL(keep_names)
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC', func_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', func_sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip %: %', func_sig, SQLERRM;
    END;
  END LOOP;
END;
$mig$;

-- Garantir EXECUTE para authenticated nas RPCs whitelisted (idempotente)
DO $mig$
DECLARE
  func_sig text;
  keep_names text[] := ARRAY[
    'is_admin','is_coordinator_or_admin','is_staff','is_admin_role',
    'is_coordenador_ou_admin','is_professor_staff','has_role',
    'fn_check_rate_limit','fn_lgpd_relatorio_titular','fn_lgpd_anonimizar_titular',
    'fn_lookup_aluno_por_cpf_hash'
  ];
BEGIN
  FOR func_sig IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(keep_names)
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', func_sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip grant %: %', func_sig, SQLERRM;
    END;
  END LOOP;
END;
$mig$;