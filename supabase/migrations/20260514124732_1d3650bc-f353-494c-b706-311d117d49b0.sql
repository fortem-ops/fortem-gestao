
-- 1) RESET DE SENHA TEMPORÁRIA PARA STAFF
-- Usa bcrypt (formato esperado pelo Supabase Auth)
UPDATE auth.users
SET encrypted_password = crypt('Fortem@2026', gen_salt('bf')),
    updated_at = now()
WHERE email IN (
  'jonas.hubner@hotmail.com',
  'nicolas.janovik@gmail.com',
  'cristianoransolin@gmail.com',
  'personalvanessac@gmail.com',
  'gustavo.caspanidubois@gmail.com',
  'brunos.funari@gmail.com',
  'igorniederauer@gmail.com',
  'thaissantospersonal@gmail.com'
);

-- 2) SYSTEM_LOGS
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  acao text NOT NULL,
  mensagem text,
  stacktrace text,
  payload jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_modulo ON public.system_logs (modulo, created_at DESC);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leem system_logs" ON public.system_logs;
CREATE POLICY "Admins leem system_logs"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Auth users inserem system_logs" ON public.system_logs;
CREATE POLICY "Auth users inserem system_logs"
  ON public.system_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3) AUDIT_LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id text,
  operacao text NOT NULL CHECK (operacao IN ('insert','update','delete')),
  user_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON public.audit_log (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON public.audit_log (tabela, registro_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coord/Admin leem audit_log" ON public.audit_log;
CREATE POLICY "Coord/Admin leem audit_log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _id := COALESCE((to_jsonb(OLD)->>'id'), NULL);
    INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, _id, 'delete', auth.uid(), to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _id := COALESCE((to_jsonb(NEW)->>'id'), NULL);
    INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, _id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    _id := COALESCE((to_jsonb(NEW)->>'id'), NULL);
    INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, _id, 'insert', auth.uid(), NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Auditoria nunca deve quebrar a operação principal
  RETURN COALESCE(NEW, OLD);
END $$;

-- Triggers em tabelas críticas
DROP TRIGGER IF EXISTS trg_audit_alunos ON public.alunos;
CREATE TRIGGER trg_audit_alunos
  AFTER INSERT OR UPDATE OR DELETE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_planos ON public.planos;
CREATE TRIGGER trg_audit_planos
  AFTER INSERT OR UPDATE OR DELETE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- Triggers condicionais (só se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendas') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_vendas ON public.vendas';
    EXECUTE 'CREATE TRIGGER trg_audit_vendas AFTER INSERT OR UPDATE OR DELETE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log()';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agenda_servicos') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_agenda_servicos ON public.agenda_servicos';
    EXECUTE 'CREATE TRIGGER trg_audit_agenda_servicos AFTER INSERT OR UPDATE OR DELETE ON public.agenda_servicos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log()';
  END IF;
END $$;

-- 4) ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tarefas_resp_status_data
  ON public.tarefas (responsavel_id, status, data_limite);

CREATE INDEX IF NOT EXISTS idx_alunos_resp_status
  ON public.alunos (responsavel_id, status);

CREATE INDEX IF NOT EXISTS idx_pipeline_movements_aluno_moved
  ON public.pipeline_movements (aluno_id, moved_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agenda_servicos') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agenda_prof_dia ON public.agenda_servicos (profissional_id, dia_semana)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agenda_prof_data ON public.agenda_servicos (profissional_id, data_especifica)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notificacao_destinatarios') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notif_dest_user_visu ON public.notificacao_destinatarios (usuario_id, visualizado_em)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id, role)';
  END IF;
END $$;
