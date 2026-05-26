
DROP POLICY IF EXISTS "Authenticated can view licencas" ON public.aluno_licencas;
CREATE POLICY "Staff or own aluno can view licencas" ON public.aluno_licencas
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS "Authenticated can view avaliacao_anexos" ON public.avaliacao_anexos;
CREATE POLICY "Staff or own aluno can view avaliacao_anexos" ON public.avaliacao_anexos
FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_anexos.avaliacao_id AND a.aluno_id = public.fn_current_aluno_id())
);

DROP POLICY IF EXISTS "Authenticated users can view avaliacao_funcional" ON public.avaliacao_funcional;
CREATE POLICY "Staff or own aluno can view avaliacao_funcional" ON public.avaliacao_funcional
FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_funcional.avaliacao_id AND a.aluno_id = public.fn_current_aluno_id())
);

DROP POLICY IF EXISTS "Authenticated users can view avaliacao_pliometria" ON public.avaliacao_pliometria;
CREATE POLICY "Staff or own aluno can view avaliacao_pliometria" ON public.avaliacao_pliometria
FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_pliometria.avaliacao_id AND a.aluno_id = public.fn_current_aluno_id())
);

DROP POLICY IF EXISTS "Authenticated users can view avaliacoes" ON public.avaliacoes;
CREATE POLICY "Staff or own aluno can view avaliacoes" ON public.avaliacoes
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS "Authenticated read comissao_config" ON public.comissionamento_config;
CREATE POLICY "Staff read comissao_config" ON public.comissionamento_config
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view historico" ON public.historico_profissional;
CREATE POLICY "Staff or own aluno can view historico" ON public.historico_profissional
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS "Authenticated can view metadata" ON public.pipeline_metadata;
CREATE POLICY "Staff can view metadata" ON public.pipeline_metadata
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view movements" ON public.pipeline_movements;
CREATE POLICY "Staff can view movements" ON public.pipeline_movements
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view anamnese" ON public.prospect_anamnese;
CREATE POLICY "Staff or own aluno can view anamnese" ON public.prospect_anamnese
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS "Authenticated users can view tarefas" ON public.tarefas;
CREATE POLICY "Involved staff can view tarefas" ON public.tarefas
FOR SELECT TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()) OR responsavel_id = auth.uid() OR criado_por_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view treinos" ON public.treinos;
CREATE POLICY "Staff or own aluno can view treinos" ON public.treinos
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR aluno_id = public.fn_current_aluno_id());

DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;
CREATE POLICY "Staff or self can view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
CREATE POLICY "Self or admin can view roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- STORAGE
DROP POLICY IF EXISTS "Authenticated users can view aluno files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload aluno files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read avaliacao anexos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload avaliacao anexos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete avaliacao anexos" ON storage.objects;

CREATE POLICY "Staff can view aluno files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'aluno-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can upload aluno files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'aluno-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update aluno files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'aluno-files' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read notif anexos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload notif anexos" ON storage.objects;

CREATE POLICY "Recipients or author read notif anexos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'notificacao-anexos'
  AND (
    EXISTS (SELECT 1 FROM public.notificacao_destinatarios nd WHERE nd.notificacao_id::text = (storage.foldername(name))[1] AND nd.usuario_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id::text = (storage.foldername(name))[1] AND n.criado_por = auth.uid())
  )
);

CREATE POLICY "Authenticated upload notif anexos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'notificacao-anexos'
  AND (
    EXISTS (SELECT 1 FROM public.notificacao_destinatarios nd WHERE nd.notificacao_id::text = (storage.foldername(name))[1] AND nd.usuario_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.id::text = (storage.foldername(name))[1] AND n.criado_por = auth.uid())
  )
);
