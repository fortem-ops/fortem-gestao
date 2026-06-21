-- ROLLBACK da migração RLS Fase 1
-- Execute APENAS em caso de emergência para reverter as políticas

ALTER TABLE public.alunos              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos_aluno      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissionamentos    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_parcelas  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clube_fortem_membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_annexes       DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alunos_staff_select"              ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_insert"              ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_update"              ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_delete"              ON public.alunos;
DROP POLICY IF EXISTS "alunos_self_select"               ON public.alunos;
DROP POLICY IF EXISTS "avaliacoes_staff_all"             ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_self_select"           ON public.avaliacoes;
DROP POLICY IF EXISTS "creditos_aluno_staff_all"         ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_self_select"       ON public.creditos_aluno;
DROP POLICY IF EXISTS "comissionamentos_coord_admin_all" ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_profissional_select" ON public.comissionamentos;
DROP POLICY IF EXISTS "parcelas_coord_admin_all"         ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "parcelas_self_select"             ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "clube_membros_staff_all"          ON public.clube_fortem_membros;
DROP POLICY IF EXISTS "clube_membros_self_select"        ON public.clube_fortem_membros;
DROP POLICY IF EXISTS "legal_staff_all"                  ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_self_select"                ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_public_insert"              ON public.legal_annexes;

DROP FUNCTION IF EXISTS public.aluno_user_id(uuid);
-- Nota: is_staff(), is_admin(), is_coordinator_or_admin() são mantidas
-- pois podem ser usadas em outras partes do sistema.
