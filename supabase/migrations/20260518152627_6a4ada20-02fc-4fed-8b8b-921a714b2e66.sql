
-- Log tables
CREATE TABLE IF NOT EXISTS public.tarefa_notificacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL,
  evento text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, evento)
);
ALTER TABLE public.tarefa_notificacoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coord/admin can view tarefa_notif_log"
  ON public.tarefa_notificacoes_log FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.notificacao_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL,
  evento text NOT NULL,
  usuario_id uuid,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notificacao_id, evento, usuario_id)
);
ALTER TABLE public.notificacao_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coord/admin can view notificacao_email_log"
  ON public.notificacao_email_log FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.agenda_diaria_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL,
  data date NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  total_eventos int NOT NULL DEFAULT 0,
  UNIQUE (profissional_id, data)
);
ALTER TABLE public.agenda_diaria_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coord/admin can view agenda_diaria_log"
  ON public.agenda_diaria_log FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

-- Config columns
ALTER TABLE public.notificacao_email_config
  ADD COLUMN IF NOT EXISTS enviar_tarefa_criada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enviar_tarefa_automatica boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enviar_notificacao_nova boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enviar_notificacao_resposta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enviar_agenda_diaria boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agenda_diaria_horario text NOT NULL DEFAULT '07:00';

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Helper to call edge function
CREATE OR REPLACE FUNCTION public.fn_call_edge_function(p_name text, p_body jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/' || p_name;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWRncWVkemVvc2ZwZWhwZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc3OTEsImV4cCI6MjA5MTY4Mzc5MX0.PhsDgfnvkBWhqNDTztFrj8AEVgQQE0fVV1qiheL_xxk';
BEGIN
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_anon, 'apikey', v_anon),
    body := p_body
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fn_call_edge_function % failed: %', p_name, SQLERRM;
END;
$$;

-- Trigger: nova tarefa
CREATE OR REPLACE FUNCTION public.fn_tarefa_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.fn_call_edge_function('notify-tarefa-evento',
    jsonb_build_object('tarefa_id', NEW.id, 'evento', 'criada'));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tarefa_after_insert ON public.tarefas;
CREATE TRIGGER trg_tarefa_after_insert
AFTER INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_after_insert();

-- Trigger: nova notificação
CREATE OR REPLACE FUNCTION public.fn_notificacao_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.fn_call_edge_function('notify-notificacao-evento',
    jsonb_build_object('notificacao_id', NEW.id, 'evento', 'nova'));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notificacao_after_insert ON public.notificacoes;
CREATE TRIGGER trg_notificacao_after_insert
AFTER INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_notificacao_after_insert();

-- Trigger: notificação respondida
CREATE OR REPLACE FUNCTION public.fn_notificacao_after_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'respondida' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.fn_call_edge_function('notify-notificacao-evento',
      jsonb_build_object('notificacao_id', NEW.id, 'evento', 'respondida'));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notificacao_after_status ON public.notificacoes;
CREATE TRIGGER trg_notificacao_after_status
AFTER UPDATE ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_notificacao_after_status();

-- Trigger: novo comentário (resposta)
CREATE OR REPLACE FUNCTION public.fn_notificacao_comentario_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.fn_call_edge_function('notify-notificacao-evento',
    jsonb_build_object('notificacao_id', NEW.notificacao_id, 'evento', 'resposta', 'comentario_id', NEW.id, 'autor_id', NEW.usuario_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notificacao_comentario_after_insert ON public.notificacao_comentarios;
CREATE TRIGGER trg_notificacao_comentario_after_insert
AFTER INSERT ON public.notificacao_comentarios
FOR EACH ROW EXECUTE FUNCTION public.fn_notificacao_comentario_after_insert();

-- Cron daily agenda
DO $$
DECLARE v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'agenda-diaria-email';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'agenda-diaria-email',
  '0 10 * * *',
  $$ SELECT public.fn_call_edge_function('notify-agenda-diaria', '{}'::jsonb); $$
);
