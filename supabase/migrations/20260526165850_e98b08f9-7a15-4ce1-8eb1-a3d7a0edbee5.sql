CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'webhook_secret') INTO v_exists;
  IF NOT v_exists THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'webhook_secret');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_webhook_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_secret' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_webhook_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_webhook_secret() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_webhook_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.fn_call_edge_function(p_name text, p_body jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url text := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/' || p_name;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWRncWVkemVvc2ZwZWhwZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc3OTEsImV4cCI6MjA5MTY4Mzc5MX0.PhsDgfnvkBWhqNDTztFrj8AEVgQQE0fVV1qiheL_xxk';
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'webhook_secret' LIMIT 1;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_anon,
      'apikey', v_anon,
      'x-webhook-secret', COALESCE(v_secret, '')
    ),
    body := p_body
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fn_call_edge_function % failed: %', p_name, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notificar_agenda_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  _evento text;
  _row record;
  _url text := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/notify-agenda-evento';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdWRncWVkemVvc2ZwZWhwZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc3OTEsImV4cCI6MjA5MTY4Mzc5MX0.PhsDgfnvkBWhqNDTztFrj8AEVgQQE0fVV1qiheL_xxk';
  _secret text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _evento := 'agendado';
    _row := NEW;
  ELSE
    _evento := 'cancelado';
    _row := OLD;
  END IF;

  IF _row.atividade NOT IN ('Treino Experimental','Avaliação Funcional') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF _row.aluno_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'webhook_secret' LIMIT 1;

  PERFORM extensions.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey', _anon,
      'Authorization','Bearer ' || _anon,
      'x-webhook-secret', COALESCE(_secret, '')
    ),
    body := jsonb_build_object(
      'evento', _evento,
      'agenda_id', _row.id,
      'origem','trigger'
    )
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;