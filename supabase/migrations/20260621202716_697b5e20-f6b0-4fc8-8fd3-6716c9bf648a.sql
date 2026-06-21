-- ============================================================
-- LEGAL_ANNEXES — LIMPEZA DE POLICIES E HARDENING
-- Fortem Gestão · 2026-06-21
-- ============================================================

-- 1. Remover policies de INSERT redundantes/confusas
DROP POLICY IF EXISTS "legal_annexes_public_insert"            ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_public_insert"                    ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_staff_insert"             ON public.legal_annexes;
DROP POLICY IF EXISTS "Block direct inserts on legal_annexes"  ON public.legal_annexes;

-- 2. Remover policies SELECT e ALL duplicadas/legadas
DROP POLICY IF EXISTS "legal_self_select"           ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_staff_select"  ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_staff_all"             ON public.legal_annexes;
DROP POLICY IF EXISTS "Admin can delete annexes"    ON public.legal_annexes;
DROP POLICY IF EXISTS "Admin can update annexes"    ON public.legal_annexes;
DROP POLICY IF EXISTS "Staff can view annexes"      ON public.legal_annexes;

-- 3. Recriar policies definitivas
DROP POLICY IF EXISTS "legal_annexes_admin_all"    ON public.legal_annexes;
DROP POLICY IF EXISTS "legal_annexes_self_select"  ON public.legal_annexes;

CREATE POLICY "legal_annexes_admin_all"
  ON public.legal_annexes FOR ALL
  USING  (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

CREATE POLICY "legal_annexes_staff_select"
  ON public.legal_annexes FOR SELECT
  USING (public.is_staff());

CREATE POLICY "legal_annexes_self_select"
  ON public.legal_annexes FOR SELECT
  USING (
    aluno_id IS NOT NULL
    AND aluno_id IN (
      SELECT id FROM public.alunos WHERE user_id = auth.uid()
    )
  );

-- 4. INSERT explicitamente bloqueado via RESTRICTIVE
DROP POLICY IF EXISTS "legal_annexes_block_direct_insert" ON public.legal_annexes;

CREATE POLICY "legal_annexes_block_direct_insert"
  ON public.legal_annexes AS RESTRICTIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- 5. GRANTs explícitos
REVOKE INSERT ON public.legal_annexes FROM anon;
REVOKE INSERT ON public.legal_annexes FROM authenticated;
GRANT SELECT ON public.legal_annexes TO authenticated;
REVOKE ALL ON public.legal_annexes FROM anon;
GRANT ALL ON public.legal_annexes TO service_role;

-- 6. Comentário de segurança
COMMENT ON TABLE public.legal_annexes IS
  'Anexos jurídicos com dados pessoais (CPF, assinatura, IP). '
  'LGPD Art. 5 II — dado pessoal sensível. '
  'INSERT: exclusivo da edge function submit-legal-annex (service_role, bypassa RLS). '
  'SELECT: staff via is_staff(); aluno via aluno_id=auth.uid(); admin via is_admin_role(). '
  'Auditado por trg_audit_legal_annexes. Retenção: 5 anos.';