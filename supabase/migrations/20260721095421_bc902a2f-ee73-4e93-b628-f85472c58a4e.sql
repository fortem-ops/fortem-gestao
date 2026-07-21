
-- 1) Harden alunos self-update: ensure sensitive-fields trigger fires ALWAYS (even in replica mode) and drop duplicate self-update policy
ALTER TABLE public.alunos DISABLE TRIGGER trg_alunos_block_self_sensitive_updates;
ALTER TABLE public.alunos ENABLE ALWAYS TRIGGER trg_alunos_block_self_sensitive_updates;

DROP POLICY IF EXISTS "Aluno atualiza próprio cadastro" ON public.alunos;

-- 2) Standardize comissionamento_config coordinator update policy to use helper function
DROP POLICY IF EXISTS comissionamento_config_coord_update ON public.comissionamento_config;
CREATE POLICY comissionamento_config_coord_update
  ON public.comissionamento_config
  FOR UPDATE
  TO authenticated
  USING (is_coordenador_ou_admin())
  WITH CHECK (is_coordenador_ou_admin());

-- 3) webhook_events_rede: add explicit fail-closed policies for UPDATE/DELETE to make intent explicit
CREATE POLICY webhook_events_rede_block_update ON public.webhook_events_rede
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY webhook_events_rede_block_delete ON public.webhook_events_rede
  FOR DELETE TO authenticated USING (false);
