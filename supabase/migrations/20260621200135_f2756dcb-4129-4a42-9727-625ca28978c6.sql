-- FASE 2B
-- 1. user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins may delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins may insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins may update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Self or coord/admin can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_self_or_coord_select" ON public.user_roles;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "user_roles_self_or_coord_select" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_coordenador_ou_admin());

-- 2. cadastro_trabalhista
DROP POLICY IF EXISTS "Admins gerenciam cadastro trabalhista" ON public.cadastro_trabalhista;
DROP POLICY IF EXISTS "Coordenadores veem cadastros" ON public.cadastro_trabalhista;
DROP POLICY IF EXISTS "Usuário vê seu próprio cadastro trabalhista" ON public.cadastro_trabalhista;
DROP POLICY IF EXISTS "cadastro_trabalhista_admin_all" ON public.cadastro_trabalhista;
DROP POLICY IF EXISTS "cadastro_trabalhista_coord_select" ON public.cadastro_trabalhista;
DROP POLICY IF EXISTS "cadastro_trabalhista_self_select" ON public.cadastro_trabalhista;

CREATE POLICY "cadastro_trabalhista_admin_all" ON public.cadastro_trabalhista FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "cadastro_trabalhista_coord_select" ON public.cadastro_trabalhista FOR SELECT
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "cadastro_trabalhista_self_select" ON public.cadastro_trabalhista FOR SELECT
  USING (usuario_id = auth.uid());

-- 3. ponto_locais_trabalho
DROP POLICY IF EXISTS "Admin manage locais" ON public.ponto_locais_trabalho;
DROP POLICY IF EXISTS "Authenticated read locais" ON public.ponto_locais_trabalho;
DROP POLICY IF EXISTS "ponto_locais_admin_all" ON public.ponto_locais_trabalho;
DROP POLICY IF EXISTS "ponto_locais_staff_select" ON public.ponto_locais_trabalho;

CREATE POLICY "ponto_locais_admin_all" ON public.ponto_locais_trabalho FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "ponto_locais_staff_select" ON public.ponto_locais_trabalho FOR SELECT
  USING (public.is_staff());

-- 4. ponto_feriados
DROP POLICY IF EXISTS "Autenticados veem feriados" ON public.ponto_feriados;
DROP POLICY IF EXISTS "Coord/admin gerencia feriados" ON public.ponto_feriados;
DROP POLICY IF EXISTS "ponto_feriados_coord_admin_all" ON public.ponto_feriados;
DROP POLICY IF EXISTS "ponto_feriados_staff_select" ON public.ponto_feriados;

CREATE POLICY "ponto_feriados_coord_admin_all" ON public.ponto_feriados FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ponto_feriados_staff_select" ON public.ponto_feriados FOR SELECT
  USING (public.is_staff());

-- 5. ponto_ferias
DROP POLICY IF EXISTS "Autenticados veem ferias" ON public.ponto_ferias;
DROP POLICY IF EXISTS "Coord/admin gerencia ferias" ON public.ponto_ferias;
DROP POLICY IF EXISTS "ponto_ferias_coord_admin_all" ON public.ponto_ferias;
DROP POLICY IF EXISTS "ponto_ferias_self_select" ON public.ponto_ferias;
DROP POLICY IF EXISTS "ponto_ferias_self_insert" ON public.ponto_ferias;

CREATE POLICY "ponto_ferias_coord_admin_all" ON public.ponto_ferias FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ponto_ferias_self_select" ON public.ponto_ferias FOR SELECT
  USING (usuario_id = auth.uid());
CREATE POLICY "ponto_ferias_self_insert" ON public.ponto_ferias FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- 6. ponto_horarios_professor
DROP POLICY IF EXISTS "Admin gerencia horários" ON public.ponto_horarios_professor;
DROP POLICY IF EXISTS "Próprio ou coord/admin vê horários" ON public.ponto_horarios_professor;
DROP POLICY IF EXISTS "ponto_horarios_coord_admin_all" ON public.ponto_horarios_professor;
DROP POLICY IF EXISTS "ponto_horarios_self_select" ON public.ponto_horarios_professor;
DROP POLICY IF EXISTS "ponto_horarios_self_update" ON public.ponto_horarios_professor;

CREATE POLICY "ponto_horarios_coord_admin_all" ON public.ponto_horarios_professor FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ponto_horarios_self_select" ON public.ponto_horarios_professor FOR SELECT
  USING (usuario_id = auth.uid());
CREATE POLICY "ponto_horarios_self_update" ON public.ponto_horarios_professor FOR UPDATE
  USING (usuario_id = auth.uid());

-- 7. ponto_eventos
DROP POLICY IF EXISTS "Próprio ou coord/admin pode ver eventos" ON public.ponto_eventos;
DROP POLICY IF EXISTS "Usuário registra próprio evento" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_coord_admin_all" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_self_select" ON public.ponto_eventos;
DROP POLICY IF EXISTS "ponto_eventos_self_insert" ON public.ponto_eventos;

CREATE POLICY "ponto_eventos_coord_admin_all" ON public.ponto_eventos FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ponto_eventos_self_select" ON public.ponto_eventos FOR SELECT
  USING (usuario_id = auth.uid());
CREATE POLICY "ponto_eventos_self_insert" ON public.ponto_eventos FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- 8. ponto_jornadas
DROP POLICY IF EXISTS "Próprio ou coord/admin vê jornadas" ON public.ponto_jornadas;
DROP POLICY IF EXISTS "Próprio ou coord/admin insere jornadas" ON public.ponto_jornadas;
DROP POLICY IF EXISTS "Coord/admin atualiza jornadas" ON public.ponto_jornadas;
DROP POLICY IF EXISTS "ponto_jornadas_coord_admin_all" ON public.ponto_jornadas;
DROP POLICY IF EXISTS "ponto_jornadas_self_select" ON public.ponto_jornadas;
DROP POLICY IF EXISTS "ponto_jornadas_self_insert" ON public.ponto_jornadas;

CREATE POLICY "ponto_jornadas_coord_admin_all" ON public.ponto_jornadas FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ponto_jornadas_self_select" ON public.ponto_jornadas FOR SELECT
  USING (usuario_id = auth.uid());
CREATE POLICY "ponto_jornadas_self_insert" ON public.ponto_jornadas FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- 9. ponto_fechamentos_mensais
DROP POLICY IF EXISTS "Coord/admin gerencia fechamentos" ON public.ponto_fechamentos_mensais;
DROP POLICY IF EXISTS "Próprio ou coord/admin vê fechamentos" ON public.ponto_fechamentos_mensais;
DROP POLICY IF EXISTS "ponto_fechamentos_coord_admin_all" ON public.ponto_fechamentos_mensais;
DROP POLICY IF EXISTS "ponto_fechamentos_self_select" ON public.ponto_fechamentos_mensais;

CREATE POLICY "ponto_fechamentos_coord_admin_all" ON public.ponto_fechamentos_mensais FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "ponto_fechamentos_self_select" ON public.ponto_fechamentos_mensais FOR SELECT
  USING (usuario_id = auth.uid());

-- 10. notificacoes
DROP POLICY IF EXISTS "Admin delete notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Staff can create notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Update own or coord/admin" ON public.notificacoes;
DROP POLICY IF EXISTS "View notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_admin_all" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_coord_select" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_coord_insert" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_coord_update" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_staff_insert" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_staff_select" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_staff_update" ON public.notificacoes;

CREATE POLICY "notificacoes_admin_all" ON public.notificacoes FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "notificacoes_coord_select" ON public.notificacoes FOR SELECT
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "notificacoes_coord_insert" ON public.notificacoes FOR INSERT
  WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "notificacoes_coord_update" ON public.notificacoes FOR UPDATE
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "notificacoes_staff_insert" ON public.notificacoes FOR INSERT
  WITH CHECK (public.is_professor_staff());
CREATE POLICY "notificacoes_staff_select" ON public.notificacoes FOR SELECT
  USING (
    public.is_professor_staff()
    AND (
      criado_por = auth.uid()
      OR id IN (SELECT notificacao_id FROM public.notificacao_destinatarios WHERE usuario_id = auth.uid())
    )
  );
CREATE POLICY "notificacoes_staff_update" ON public.notificacoes FOR UPDATE
  USING (public.is_professor_staff() AND criado_por = auth.uid());

-- 11. notificacao_destinatarios
DROP POLICY IF EXISTS "Delete dest by criador or admin" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "Insert dest by criador or coord" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "Update own dest or criador/coord" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "View dest" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "notif_dest_admin_all" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "notif_dest_coord_all" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "notif_dest_staff_insert" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "notif_dest_self_select" ON public.notificacao_destinatarios;
DROP POLICY IF EXISTS "notif_dest_self_update" ON public.notificacao_destinatarios;

CREATE POLICY "notif_dest_admin_all" ON public.notificacao_destinatarios FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "notif_dest_coord_all" ON public.notificacao_destinatarios FOR ALL
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "notif_dest_staff_insert" ON public.notificacao_destinatarios FOR INSERT
  WITH CHECK (
    public.is_professor_staff()
    AND notificacao_id IN (SELECT id FROM public.notificacoes WHERE criado_por = auth.uid())
  );
CREATE POLICY "notif_dest_self_select" ON public.notificacao_destinatarios FOR SELECT
  USING (usuario_id = auth.uid());
CREATE POLICY "notif_dest_self_update" ON public.notificacao_destinatarios FOR UPDATE
  USING (usuario_id = auth.uid());

-- 12. notificacao_comentarios
DROP POLICY IF EXISTS "Admin delete comentarios" ON public.notificacao_comentarios;
DROP POLICY IF EXISTS "Insert comentarios" ON public.notificacao_comentarios;
DROP POLICY IF EXISTS "View comentarios" ON public.notificacao_comentarios;
DROP POLICY IF EXISTS "notif_coment_admin_all" ON public.notificacao_comentarios;
DROP POLICY IF EXISTS "notif_coment_staff_select" ON public.notificacao_comentarios;
DROP POLICY IF EXISTS "notif_coment_staff_insert" ON public.notificacao_comentarios;
DROP POLICY IF EXISTS "notif_coment_self_delete" ON public.notificacao_comentarios;

CREATE POLICY "notif_coment_admin_all" ON public.notificacao_comentarios FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "notif_coment_staff_select" ON public.notificacao_comentarios FOR SELECT
  USING (
    public.is_staff()
    AND notificacao_id IN (
      SELECT id FROM public.notificacoes WHERE criado_por = auth.uid()
      UNION
      SELECT notificacao_id FROM public.notificacao_destinatarios WHERE usuario_id = auth.uid()
    )
  );
CREATE POLICY "notif_coment_staff_insert" ON public.notificacao_comentarios FOR INSERT
  WITH CHECK (
    public.is_staff()
    AND usuario_id = auth.uid()
    AND notificacao_id IN (
      SELECT id FROM public.notificacoes WHERE criado_por = auth.uid()
      UNION
      SELECT notificacao_id FROM public.notificacao_destinatarios WHERE usuario_id = auth.uid()
    )
  );
CREATE POLICY "notif_coment_self_delete" ON public.notificacao_comentarios FOR DELETE
  USING (usuario_id = auth.uid());

-- 13. creditos_movimentos
DROP POLICY IF EXISTS "mov_admin_write" ON public.creditos_movimentos;
DROP POLICY IF EXISTS "mov_view" ON public.creditos_movimentos;
DROP POLICY IF EXISTS "creditos_mov_admin_all" ON public.creditos_movimentos;
DROP POLICY IF EXISTS "creditos_mov_coord_all" ON public.creditos_movimentos;
DROP POLICY IF EXISTS "creditos_mov_staff_select" ON public.creditos_movimentos;
DROP POLICY IF EXISTS "creditos_mov_staff_insert" ON public.creditos_movimentos;
DROP POLICY IF EXISTS "creditos_mov_self_select" ON public.creditos_movimentos;

CREATE POLICY "creditos_mov_admin_all" ON public.creditos_movimentos FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "creditos_mov_coord_all" ON public.creditos_movimentos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'coordenador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'coordenador'));
CREATE POLICY "creditos_mov_staff_select" ON public.creditos_movimentos FOR SELECT
  USING (public.is_professor_staff());
CREATE POLICY "creditos_mov_staff_insert" ON public.creditos_movimentos FOR INSERT
  WITH CHECK (public.is_professor_staff() AND registrado_por = auth.uid());
CREATE POLICY "creditos_mov_self_select" ON public.creditos_movimentos FOR SELECT
  USING (
    credito_id IN (
      SELECT id FROM public.creditos_aluno
      WHERE aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid())
    )
  );

-- 14. consumo_servicos
DROP POLICY IF EXISTS "Admin can delete consumo" ON public.consumo_servicos;
DROP POLICY IF EXISTS "Coord/admin can update consumo" ON public.consumo_servicos;
DROP POLICY IF EXISTS "Staff can insert consumo" ON public.consumo_servicos;
DROP POLICY IF EXISTS "Staff or owner can view consumo" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_admin_all" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_coord_select" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_coord_insert" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_coord_update" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_staff_select" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_staff_insert" ON public.consumo_servicos;
DROP POLICY IF EXISTS "consumo_servicos_self_select" ON public.consumo_servicos;

CREATE POLICY "consumo_servicos_admin_all" ON public.consumo_servicos FOR ALL
  USING (public.is_admin_role()) WITH CHECK (public.is_admin_role());
CREATE POLICY "consumo_servicos_coord_select" ON public.consumo_servicos FOR SELECT
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "consumo_servicos_coord_insert" ON public.consumo_servicos FOR INSERT
  WITH CHECK (public.is_coordenador_ou_admin());
CREATE POLICY "consumo_servicos_coord_update" ON public.consumo_servicos FOR UPDATE
  USING (public.is_coordenador_ou_admin());
CREATE POLICY "consumo_servicos_staff_select" ON public.consumo_servicos FOR SELECT
  USING (public.is_professor_staff());
CREATE POLICY "consumo_servicos_staff_insert" ON public.consumo_servicos FOR INSERT
  WITH CHECK (public.is_professor_staff() AND registrado_por = auth.uid());
CREATE POLICY "consumo_servicos_self_select" ON public.consumo_servicos FOR SELECT
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE user_id = auth.uid()));