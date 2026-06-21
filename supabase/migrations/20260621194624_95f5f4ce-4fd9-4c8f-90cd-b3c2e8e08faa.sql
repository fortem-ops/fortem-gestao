-- =============================================================================
-- MIGRAÇÃO: RLS Fase 1 — Segurança crítica
-- Criado em: 2026-06-21
-- Tabelas: alunos, avaliacoes, creditos_aluno, comissionamentos,
--          pagamento_parcelas, clube_fortem_membros, legal_annexes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- HELPER: is_staff()
-- Retorna TRUE se o usuário autenticado tem papel de staff (admin, coordenador,
-- professor, nutricionista, fisioterapeuta). Usada em todas as políticas RLS.
-- SECURITY DEFINER garante que a função roda com privilégios do owner (postgres),
-- não do usuário chamador — necessário para consultar user_roles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordenador', 'professor', 'nutricionista', 'fisioterapeuta')
  );
$$;

-- Helper: is_admin() — já pode existir, recriamos com SECURITY DEFINER garantido
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

-- Helper: is_coordinator_or_admin() — recriamos com SECURITY DEFINER garantido
CREATE OR REPLACE FUNCTION public.is_coordinator_or_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'coordenador')
  );
$$;

-- Helper: aluno_user_id(aluno_id) — resolve o auth.uid() de um aluno
-- Alunos têm user_id próprio na tabela alunos para acesso ao portal
CREATE OR REPLACE FUNCTION public.aluno_user_id(p_aluno_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.alunos WHERE id = p_aluno_id LIMIT 1;
$$;

-- =============================================================================
-- 1. TABELA: alunos
-- Staff lê e atualiza todos. Aluno lê apenas o próprio (via portal).
-- Apenas admin/coordenador insere e deleta.
-- =============================================================================
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "alunos_staff_select"  ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_insert"  ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_update"  ON public.alunos;
DROP POLICY IF EXISTS "alunos_staff_delete"  ON public.alunos;
DROP POLICY IF EXISTS "alunos_self_select"   ON public.alunos;

-- Staff: leitura total
CREATE POLICY "alunos_staff_select" ON public.alunos
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- Admin/coordenador: inserção
CREATE POLICY "alunos_staff_insert" ON public.alunos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_or_admin());

-- Staff: atualização
CREATE POLICY "alunos_staff_update" ON public.alunos
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Admin: deleção
CREATE POLICY "alunos_staff_delete" ON public.alunos
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Portal do aluno: cada aluno lê o próprio registro
CREATE POLICY "alunos_self_select" ON public.alunos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- 2. TABELA: avaliacoes
-- Staff lê e escreve todas. Aluno lê apenas as próprias avaliações.
-- =============================================================================
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avaliacoes_staff_all"   ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_self_select" ON public.avaliacoes;

-- Staff: acesso total
CREATE POLICY "avaliacoes_staff_all" ON public.avaliacoes
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Portal do aluno: lê apenas as próprias avaliações
CREATE POLICY "avaliacoes_self_select" ON public.avaliacoes
  FOR SELECT TO authenticated
  USING (
    aluno_id IN (
      SELECT id FROM public.alunos WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. TABELA: creditos_aluno
-- Staff lê e escreve todos. Aluno lê apenas os próprios créditos (portal).
-- =============================================================================
ALTER TABLE public.creditos_aluno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creditos_aluno_staff_all"   ON public.creditos_aluno;
DROP POLICY IF EXISTS "creditos_aluno_self_select" ON public.creditos_aluno;

CREATE POLICY "creditos_aluno_staff_all" ON public.creditos_aluno
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "creditos_aluno_self_select" ON public.creditos_aluno
  FOR SELECT TO authenticated
  USING (
    aluno_id IN (
      SELECT id FROM public.alunos WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- 4. TABELA: comissionamentos
-- Admin e coordenador: acesso total.
-- Profissional: lê e atualiza apenas os próprios comissionamentos.
-- =============================================================================
ALTER TABLE public.comissionamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comissionamentos_coord_admin_all"   ON public.comissionamentos;
DROP POLICY IF EXISTS "comissionamentos_profissional_select" ON public.comissionamentos;

-- Admin/coordenador: acesso total
CREATE POLICY "comissionamentos_coord_admin_all" ON public.comissionamentos
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin())
  WITH CHECK (public.is_coordinator_or_admin());

-- Profissional: lê apenas os próprios
CREATE POLICY "comissionamentos_profissional_select" ON public.comissionamentos
  FOR SELECT TO authenticated
  USING (profissional_id = auth.uid());

-- =============================================================================
-- 5. TABELA: pagamento_parcelas
-- Admin/coordenador: acesso total.
-- Aluno: lê apenas as próprias parcelas (portal).
-- OBS: pagamento_parcelas não tem aluno_id direto; resolve via pagamentos.
-- =============================================================================
ALTER TABLE public.pagamento_parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parcelas_coord_admin_all" ON public.pagamento_parcelas;
DROP POLICY IF EXISTS "parcelas_self_select"     ON public.pagamento_parcelas;

CREATE POLICY "parcelas_coord_admin_all" ON public.pagamento_parcelas
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin())
  WITH CHECK (public.is_coordinator_or_admin());

CREATE POLICY "parcelas_self_select" ON public.pagamento_parcelas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pagamentos p
      JOIN public.alunos a ON a.id = p.aluno_id
      WHERE p.id = pagamento_parcelas.pagamento_id
        AND a.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. TABELA: clube_fortem_membros
-- Staff: acesso total (inclui qr_secret para scanner do parceiro).
-- Aluno: lê apenas o próprio registro — sem expor qr_secret de outros membros.
-- =============================================================================
ALTER TABLE public.clube_fortem_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clube_membros_staff_all"  ON public.clube_fortem_membros;
DROP POLICY IF EXISTS "clube_membros_self_select" ON public.clube_fortem_membros;

CREATE POLICY "clube_membros_staff_all" ON public.clube_fortem_membros
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "clube_membros_self_select" ON public.clube_fortem_membros
  FOR SELECT TO authenticated
  USING (
    aluno_id IN (
      SELECT id FROM public.alunos WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- 7. TABELA: legal_annexes
-- Contém CPF, dados de saúde, assinatura digital, IP — LGPD sensível.
-- Staff: acesso total.
-- Aluno: lê apenas o próprio (via aluno_id).
-- Público (não autenticado): INSERT permitido para fluxo de assinatura pública
--   em /assinar e /assinar-experimental — mas sem SELECT.
-- =============================================================================
ALTER TABLE public.legal_annexes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_staff_all"          ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_self_select"        ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_public_insert"      ON public.legal_annexes;

-- Staff: acesso total
CREATE POLICY "legal_staff_all" ON public.legal_annexes
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Aluno autenticado (portal): lê os próprios
CREATE POLICY "legal_self_select" ON public.legal_annexes
  FOR SELECT TO authenticated
  USING (
    aluno_id IN (
      SELECT id FROM public.alunos WHERE user_id = auth.uid()
    )
  );

-- Fluxo público de assinatura (/assinar, /assinar-experimental):
-- Permite INSERT sem autenticação (visitante assina o termo)
-- O SELECT e UPDATE continuam protegidos
CREATE POLICY "legal_public_insert" ON public.legal_annexes
  FOR INSERT TO anon
  WITH CHECK (true);

-- =============================================================================
-- GRANT: garantir que as funções helper são acessíveis aos roles corretos
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.is_staff()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator_or_admin(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_user_id(uuid)                     TO authenticated;

-- =============================================================================
-- FIM DA MIGRAÇÃO
-- Para aplicar: supabase db push  ou  copie e cole no SQL Editor do Supabase
-- Para reverter: ver arquivo 20260621000001_rls_fase1_rollback.sql
-- =============================================================================
