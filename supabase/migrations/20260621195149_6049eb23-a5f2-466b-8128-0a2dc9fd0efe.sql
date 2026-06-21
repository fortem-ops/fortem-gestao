CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 1. alunos
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alunos_staff_select" ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_update" ON public.alunos;
DROP POLICY IF EXISTS "alunos_admin_insert" ON public.alunos;
DROP POLICY IF EXISTS "alunos_admin_delete" ON public.alunos;
DROP POLICY IF EXISTS "alunos_self_select" ON public.alunos;
DROP POLICY IF EXISTS "alunos_self_update" ON public.alunos;
CREATE POLICY "alunos_staff_select" ON public.alunos FOR SELECT USING (public.is_staff());
CREATE POLICY "alunos_staff_update" ON public.alunos FOR UPDATE USING (public.is_staff());
CREATE POLICY "alunos_admin_insert" ON public.alunos FOR INSERT WITH CHECK (public.is_admin_role());
CREATE POLICY "alunos_admin_delete" ON public.alunos FOR DELETE USING (public.is_admin_role());
CREATE POLICY "alunos_self_select" ON public.alunos FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "alunos_self_update" ON public.alunos FOR UPDATE USING (user_id = auth.uid());

-- 2. avaliacoes
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avaliacoes_staff_select" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_staff_insert" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_staff_update" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_admin_delete" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_self_select" ON public.avaliacoes;
CREATE POLICY "avaliacoes_staff_select" ON public.avaliacoes FOR SELECT USING (public.is_staff());
CREATE POLICY "avaliacoes_staff_insert" ON public.avaliacoes FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "avaliacoes_staff_update" ON public.avaliacoes FOR UPDATE USING (public.is_staff());
CREATE POLICY "avaliacoes_admin_delete" ON public.avaliacoes FOR DELETE USING (public.is_admin_role());
CREATE POLICY "avaliacoes_self_select" ON public.avaliacoes FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

-- 3. creditos_aluno
ALTER TABLE public.creditos_aluno ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creditos_aluno_staff_select" ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_staff_update" ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_admin_insert" ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_admin_delete" ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_self_select" ON public.creditos_aluno;
CREATE POLICY "creditos_aluno_staff_select" ON public.creditos_aluno FOR SELECT USING (public.is_staff());
CREATE POLICY "creditos_aluno_staff_update" ON public.creditos_aluno FOR UPDATE USING (public.is_staff());
CREATE POLICY "creditos_aluno_admin_insert" ON public.creditos_aluno FOR INSERT WITH CHECK (public.is_admin_role());
CREATE POLICY "creditos_aluno_admin_delete" ON public.creditos_aluno FOR DELETE USING (public.is_admin_role());
CREATE POLICY "creditos_aluno_self_select" ON public.creditos_aluno FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

-- 4. comissionamentos
ALTER TABLE public.comissionamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comissionamentos_admin_all" ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_self_select" ON public.comissionamentos;
CREATE POLICY "comissionamentos_admin_all" ON public.comissionamentos FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "comissionamentos_self_select" ON public.comissionamentos FOR SELECT
  USING (profissional_id = auth.uid());

-- 5. pagamento_parcelas (acesso do aluno via pagamento_id -> pagamentos.aluno_id)
ALTER TABLE public.pagamento_parcelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagamento_parcelas_admin_all" ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_staff_select" ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_staff_write" ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_staff_update" ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "pagamento_parcelas_self_select" ON public.pagamento_parcelas;
CREATE POLICY "pagamento_parcelas_admin_all" ON public.pagamento_parcelas FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "pagamento_parcelas_staff_select" ON public.pagamento_parcelas FOR SELECT USING (public.is_staff());
CREATE POLICY "pagamento_parcelas_staff_write" ON public.pagamento_parcelas FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "pagamento_parcelas_staff_update" ON public.pagamento_parcelas FOR UPDATE USING (public.is_staff());
CREATE POLICY "pagamento_parcelas_self_select" ON public.pagamento_parcelas FOR SELECT
  USING (pagamento_id IN (
    SELECT id FROM public.pagamentos
    WHERE aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid())
  ));

-- 6. clube_fortem_membros
ALTER TABLE public.clube_fortem_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clube_membros_admin_all" ON public.clube_fortem_membros;
DROP POLICY IF EXISTS "clube_membros_staff_select" ON public.clube_fortem_membros;
DROP POLICY IF EXISTS "clube_membros_staff_update" ON public.clube_fortem_membros;
DROP POLICY IF EXISTS "clube_membros_self_select" ON public.clube_fortem_membros;
CREATE POLICY "clube_membros_admin_all" ON public.clube_fortem_membros FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "clube_membros_staff_select" ON public.clube_fortem_membros FOR SELECT USING (public.is_staff());
CREATE POLICY "clube_membros_staff_update" ON public.clube_fortem_membros FOR UPDATE USING (public.is_staff());
CREATE POLICY "clube_membros_self_select" ON public.clube_fortem_membros FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));

-- 7. legal_annexes
ALTER TABLE public.legal_annexes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legal_annexes_admin_all" ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_staff_select" ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_staff_insert" ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_self_select" ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_public_insert" ON public.legal_annexes;
CREATE POLICY "legal_annexes_admin_all" ON public.legal_annexes FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "legal_annexes_staff_select" ON public.legal_annexes FOR SELECT USING (public.is_staff());
CREATE POLICY "legal_annexes_staff_insert" ON public.legal_annexes FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "legal_annexes_self_select" ON public.legal_annexes FOR SELECT
  USING (aluno_id IS NOT NULL AND aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));
CREATE POLICY "legal_annexes_public_insert" ON public.legal_annexes FOR INSERT WITH CHECK (true);