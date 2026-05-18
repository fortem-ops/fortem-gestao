
-- 1) Tabela de log/idempotência
CREATE TABLE IF NOT EXISTS public.agenda_notificacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL,
  evento text NOT NULL CHECK (evento IN ('agendado','cancelado')),
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  origem text,
  CONSTRAINT agenda_notificacoes_log_unico UNIQUE (agenda_id, evento)
);

ALTER TABLE public.agenda_notificacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord/admin can view notificacoes_log"
  ON public.agenda_notificacoes_log FOR SELECT TO authenticated
  USING (is_coordinator_or_admin(auth.uid()));

-- 2) Garantir extensão pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3) Função de trigger
CREATE OR REPLACE FUNCTION public.fn_notificar_agenda_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _evento text;
  _row record;
  _url text := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/notify-agenda-evento';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWRncWVkemVvc2ZwZWhwZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc3OTEsImV4cCI6MjA5MTY4Mzc5MX0.PhsDgfnvkBWhqNDTztFrj8AEVgQQE0fVV1qiheL_xxk';
BEGIN
  IF TG_OP = 'INSERT' THEN
    _evento := 'agendado';
    _row := NEW;
  ELSE
    _evento := 'cancelado';
    _row := OLD;
  END IF;

  -- Filtros
  IF _row.atividade NOT IN ('Treino Experimental','Avaliação Funcional') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF _row.aluno_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Dispara HTTP POST assíncrono
  PERFORM extensions.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey', _anon,
      'Authorization','Bearer '||_anon
    ),
    body := jsonb_build_object(
      'evento', _evento,
      'agenda_id', _row.id,
      'origem','trigger'
    )
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebrar a operação principal por causa do email
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Triggers
DROP TRIGGER IF EXISTS trg_notificar_agenda_insert ON public.agenda_servicos;
CREATE TRIGGER trg_notificar_agenda_insert
  AFTER INSERT ON public.agenda_servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_agenda_evento();

DROP TRIGGER IF EXISTS trg_notificar_agenda_delete ON public.agenda_servicos;
CREATE TRIGGER trg_notificar_agenda_delete
  AFTER DELETE ON public.agenda_servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_agenda_evento();
