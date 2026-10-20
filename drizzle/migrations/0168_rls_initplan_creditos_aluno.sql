ALTER POLICY creditos_aluno_admin_all ON public.creditos_aluno USING ((select public.is_admin_role())) WITH CHECK ((select public.is_admin_role()));
ALTER POLICY creditos_aluno_coord_all ON public.creditos_aluno USING ((select public.is_coordenador_ou_admin())) WITH CHECK ((select public.is_coordenador_ou_admin()));
ALTER POLICY creditos_aluno_prof_select ON public.creditos_aluno USING ((select public.is_professor_staff()));
ALTER POLICY creditos_aluno_prof_update ON public.creditos_aluno USING ((select public.is_professor_staff()));
ALTER POLICY creditos_aluno_self_select ON public.creditos_aluno USING (aluno_id IN (SELECT a.id FROM public.alunos a WHERE a.user_id = (select auth.uid())));