-- =============================================================================
-- CORREÇÃO FINAL: permissões das funções helper RLS Fase 1
-- Revoga EXECUTE de PUBLIC e garante para authenticated/service_role
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.is_staff()                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid)                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_coordinator_or_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aluno_user_id(uuid)           FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_staff()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_user_id(uuid)           TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_staff()                    TO service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.is_coordinator_or_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.aluno_user_id(uuid)           TO service_role;
