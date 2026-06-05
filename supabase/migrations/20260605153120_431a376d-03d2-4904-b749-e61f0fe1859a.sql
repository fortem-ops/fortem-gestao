
-- 1. agenda_servicos: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view agenda" ON public.agenda_servicos;
CREATE POLICY "View agenda scoped" ON public.agenda_servicos
FOR SELECT TO authenticated
USING (
  is_staff(auth.uid())
  OR profissional_id = auth.uid()
  OR aluno_id = fn_current_aluno_id()
);

-- 2. agenda_servicos_excecoes: mirror restriction
DROP POLICY IF EXISTS "Authenticated view agenda excecoes" ON public.agenda_servicos_excecoes;
CREATE POLICY "View agenda excecoes scoped" ON public.agenda_servicos_excecoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agenda_servicos a
    WHERE a.id = agenda_servicos_excecoes.agenda_id
      AND (
        is_staff(auth.uid())
        OR a.profissional_id = auth.uid()
        OR a.aluno_id = fn_current_aluno_id()
      )
  )
);

-- 3. clube_fortem_membros: restrict qr_secret access to coord/admin or owner
DROP POLICY IF EXISTS "Staff or member can view membros" ON public.clube_fortem_membros;
CREATE POLICY "Coord/admin or owner can view membros" ON public.clube_fortem_membros
FOR SELECT TO authenticated
USING (
  is_coordinator_or_admin(auth.uid())
  OR aluno_id = fn_current_aluno_id()
);

-- 4. legal_annexes: remove anon insert; allow authenticated only. Server-side submissions use service_role and bypass RLS.
DROP POLICY IF EXISTS "Anyone can submit legal annex" ON public.legal_annexes;
CREATE POLICY "Authenticated can submit legal annex" ON public.legal_annexes
FOR INSERT TO authenticated
WITH CHECK (true);

-- 5. parceiros_publico view: enforce security_invoker
ALTER VIEW public.parceiros_publico SET (security_invoker = on);
