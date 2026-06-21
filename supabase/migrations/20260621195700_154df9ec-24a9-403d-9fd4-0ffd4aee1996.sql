-- ============================================================
-- FASE 2 — RLS GRANULAR: TABELAS FINANCEIRAS
-- Fortem Gestão · 2026-06-21
-- ============================================================

-- HELPERS
CREATE OR REPLACE FUNCTION public.is_coordenador_ou_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','coordenador')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_professor_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('professor','nutricionista','fisioterapeuta')
  );
$$;

-- ===========================================================
-- 1. comissionamento_config
-- ===========================================================
ALTER TABLE public.comissionamento_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coord/admin manage comissao_config"      ON public.comissionamento_config;
DROP POLICY IF EXISTS "Staff read comissao_config"              ON public.comissionamento_config;
DROP POLICY IF EXISTS "comissionamento_config_admin_all"        ON public.comissionamento_config;
DROP POLICY IF EXISTS "comissionamento_config_coord_admin_all"  ON public.comissionamento_config;
DROP POLICY IF EXISTS "comissionamento_config_staff_select"     ON public.comissionamento_config;
DROP POLICY IF EXISTS "comissionamento_config_coord_select"     ON public.comissionamento_config;
DROP POLICY IF EXISTS "comissionamento_config_coord_update"     ON public.comissionamento_config;

CREATE POLICY "comissionamento_config_admin_all"
  ON public.comissionamento_config FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());

CREATE POLICY "comissionamento_config_coord_select"
  ON public.comissionamento_config FOR SELECT
  USING (public.is_coordenador_ou_admin());

CREATE POLICY "comissionamento_config_coord_update"
  ON public.comissionamento_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'coordenador'
    )
  );

-- ===========================================================
-- 2. comissionamentos
-- ===========================================================
ALTER TABLE public.comissionamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin delete comissao"                   ON public.comissionamentos;
DROP POLICY IF EXISTS "Coord/admin insert comissao"             ON public.comissionamentos;
DROP POLICY IF EXISTS "Coord/admin update comissao"             ON public.comissionamentos;
DROP POLICY IF EXISTS "View comissao own or coord/admin"        ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_admin_all"              ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_self_select"            ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_coord_admin_all"        ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_profissional_select"    ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_coord_select"           ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_coord_insert"           ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_coord_update"           ON public.comissionamentos;

CREATE POLICY "comissionamentos_admin_all"
  ON public.comissionamentos FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());

CREATE POLICY "comissionamentos_coord_select"
  ON public.comissionamentos FOR SELECT USING (public.is_coordenador_ou_admin());

CREATE POLICY "comissionamentos_coord_insert"
  ON public.comissionamentos FOR INSERT WITH CHECK (public.is_coordenador_ou_admin());

CREATE POLICY "comissionamentos_coord_update"
  ON public.comissionamentos FOR UPDATE USING (public.is_coordenador_ou_admin());

CREATE POLICY "comissionamentos_profissional_select"
  ON public.comissionamentos FOR SELECT
  USING (public.is_professor_staff() AND profissional_id = auth.uid());

-- ===========================================================
-- 3. creditos_aluno
-- ===========================================================
ALTER TABLE public.creditos_aluno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creditos_admin_write"               ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_view"                      ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_staff_all"           ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_staff_select"        ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_staff_update"        ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_admin_insert"        ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_admin_delete"        ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_self_select"         ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_admin_all"           ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_coord_all"           ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_prof_select"         ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_prof_update"         ON public.creditos_aluno;

CREATE POLICY "creditos_aluno_admin_all"
  ON public.creditos_aluno FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());

CREATE POLICY "creditos_aluno_coord_all"
  ON public.creditos_aluno FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'coordenador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'coordenador')
  );

CREATE POLICY "creditos_aluno_prof_select"
  ON public.creditos_aluno FOR SELECT USING (public.is_professor_staff());

CREATE POLICY "creditos_aluno_prof_update"
  ON public.creditos_aluno FOR UPDATE USING (public.is_professor_staff());

CREATE POLICY "creditos_aluno_self_select"
  ON public.creditos_aluno FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

-- ===========================================================
-- 4. pagamento_parcelas
-- ===========================================================
ALTER TABLE public.pagamento_parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff or owner can view parcelas"       ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "coord_manage_par"                       ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "parcelas_coord_admin_all"               ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "parcelas_self_select"                   ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_admin_all"           ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_staff_select"        ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_staff_write"         ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_staff_update"        ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_self_select"         ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_coord_select"        ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_coord_insert"        ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_coord_update"        ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_prof_select"         ON public.pagamento_parcelas;

CREATE POLICY "pagamento_parcelas_admin_all"
  ON public.pagamento_parcelas FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());

CREATE POLICY "pagamento_parcelas_coord_select"
  ON public.pagamento_parcelas FOR SELECT USING (public.is_coordenador_ou_admin());

CREATE POLICY "pagamento_parcelas_coord_insert"
  ON public.pagamento_parcelas FOR INSERT WITH CHECK (public.is_coordenador_ou_admin());

CREATE POLICY "pagamento_parcelas_coord_update"
  ON public.pagamento_parcelas FOR UPDATE USING (public.is_coordenador_ou_admin());

CREATE POLICY "pagamento_parcelas_prof_select"
  ON public.pagamento_parcelas FOR SELECT USING (public.is_professor_staff());

CREATE POLICY "pagamento_parcelas_self_select"
  ON public.pagamento_parcelas FOR SELECT
  USING (
    pagamento_id IN (
      SELECT id FROM public.pagamentos
      WHERE aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid())
    )
  );