
-- alunos
DROP POLICY IF EXISTS "alunos_admin_all" ON public.alunos;
CREATE POLICY "alunos_admin_all" ON public.alunos AS PERMISSIVE FOR ALL TO authenticated USING (is_admin_role()) WITH CHECK (is_admin_role());

DROP POLICY IF EXISTS "alunos_coord_select" ON public.alunos;
CREATE POLICY "alunos_coord_select" ON public.alunos FOR SELECT TO authenticated USING (is_coordenador_ou_admin());

DROP POLICY IF EXISTS "alunos_coord_update" ON public.alunos;
CREATE POLICY "alunos_coord_update" ON public.alunos FOR UPDATE TO authenticated USING (is_coordenador_ou_admin());

DROP POLICY IF EXISTS "alunos_self_select" ON public.alunos;
CREATE POLICY "alunos_self_select" ON public.alunos FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "alunos_self_update" ON public.alunos;
CREATE POLICY "alunos_self_update" ON public.alunos FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "alunos_staff_select" ON public.alunos;
CREATE POLICY "alunos_staff_select" ON public.alunos FOR SELECT TO authenticated USING (is_professor_staff());

-- cartoes_salvos
DROP POLICY IF EXISTS "cartoes_admin_all" ON public.cartoes_salvos;
CREATE POLICY "cartoes_admin_all" ON public.cartoes_salvos AS PERMISSIVE FOR ALL TO authenticated USING (is_admin_role()) WITH CHECK (is_admin_role());

DROP POLICY IF EXISTS "cartoes_coord_select" ON public.cartoes_salvos;
CREATE POLICY "cartoes_coord_select" ON public.cartoes_salvos FOR SELECT TO authenticated USING (is_coordenador_ou_admin());

DROP POLICY IF EXISTS "cartoes_self_select" ON public.cartoes_salvos;
CREATE POLICY "cartoes_self_select" ON public.cartoes_salvos FOR SELECT TO authenticated USING (aluno_id IN (SELECT alunos.id FROM alunos WHERE alunos.user_id = auth.uid()));

DROP POLICY IF EXISTS "cartoes_self_delete" ON public.cartoes_salvos;
CREATE POLICY "cartoes_self_delete" ON public.cartoes_salvos FOR DELETE TO authenticated USING (aluno_id IN (SELECT alunos.id FROM alunos WHERE alunos.user_id = auth.uid()));

-- legal_annexes
DROP POLICY IF EXISTS "legal_annexes_admin_all" ON public.legal_annexes;
CREATE POLICY "legal_annexes_admin_all" ON public.legal_annexes AS PERMISSIVE FOR ALL TO authenticated USING (is_admin_role()) WITH CHECK (is_admin_role());

DROP POLICY IF EXISTS "legal_annexes_self_select" ON public.legal_annexes;
CREATE POLICY "legal_annexes_self_select" ON public.legal_annexes FOR SELECT TO authenticated USING ((aluno_id IS NOT NULL) AND (aluno_id IN (SELECT alunos.id FROM alunos WHERE alunos.user_id = auth.uid())));

DROP POLICY IF EXISTS "legal_annexes_staff_select" ON public.legal_annexes;
CREATE POLICY "legal_annexes_staff_select" ON public.legal_annexes FOR SELECT TO authenticated USING (is_staff());
