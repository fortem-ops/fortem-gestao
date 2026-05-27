
-- 1. agenda_presencas: restrict SELECT
DROP POLICY IF EXISTS "Authenticated can view presencas" ON public.agenda_presencas;
CREATE POLICY "Staff or own aluno can view presencas"
ON public.agenda_presencas
FOR SELECT
TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.agenda_servicos a
    WHERE a.id = agenda_presencas.agenda_id
      AND a.aluno_id IS NOT NULL
      AND a.aluno_id = public.fn_current_aluno_id()
  )
);

-- 2. parceiros: restrict SELECT to staff or owner
DROP POLICY IF EXISTS "Authenticated can view parceiros" ON public.parceiros;
CREATE POLICY "Staff or owner can view parceiros"
ON public.parceiros
FOR SELECT
TO authenticated
USING (
  public.is_staff(auth.uid())
  OR user_id = auth.uid()
);

-- 3. Public-safe view for students
CREATE OR REPLACE VIEW public.parceiros_publico
WITH (security_invoker = true) AS
SELECT
  id, nome, categoria, descricao, logo_url, endereco,
  latitude, longitude, modo_validacao, pontuacao_engajamento, ativo
FROM public.parceiros
WHERE ativo = true;

GRANT SELECT ON public.parceiros_publico TO authenticated;

-- Allow authenticated users to read active partners via the view by
-- creating a permissive SELECT policy gated by ativo=true for non-staff.
CREATE POLICY "Authenticated can view active partner public fields"
ON public.parceiros
FOR SELECT
TO authenticated
USING (ativo = true);
