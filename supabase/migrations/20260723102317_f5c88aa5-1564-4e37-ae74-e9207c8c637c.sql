
-- adquirentes: restrict SELECT to staff
DROP POLICY IF EXISTS adquirentes_taxas_select_auth ON public.adquirentes_taxas;
CREATE POLICY adquirentes_taxas_select_staff ON public.adquirentes_taxas
  FOR SELECT TO authenticated USING (is_coordenador_ou_admin());

DROP POLICY IF EXISTS adquirentes_config_select_auth ON public.adquirentes_config;
CREATE POLICY adquirentes_config_select_staff ON public.adquirentes_config
  FOR SELECT TO authenticated USING (is_coordenador_ou_admin());

-- creditos: replace inline role check with helper (covers admin + coordenador)
DROP POLICY IF EXISTS creditos_aluno_coord_all ON public.creditos_aluno;
CREATE POLICY creditos_aluno_coord_all ON public.creditos_aluno
  FOR ALL TO authenticated
  USING (is_coordenador_ou_admin())
  WITH CHECK (is_coordenador_ou_admin());

DROP POLICY IF EXISTS creditos_mov_coord_all ON public.creditos_movimentos;
CREATE POLICY creditos_mov_coord_all ON public.creditos_movimentos
  FOR ALL TO authenticated
  USING (is_coordenador_ou_admin())
  WITH CHECK (is_coordenador_ou_admin());

-- ponto_configuracoes: restrict SELECT to self or admin
DROP POLICY IF EXISTS "Autenticados veem configurações" ON public.ponto_configuracoes;
CREATE POLICY ponto_config_select_self_or_admin ON public.ponto_configuracoes
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR usuario_id IS NULL OR is_admin(auth.uid()));
