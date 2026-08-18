CREATE OR REPLACE FUNCTION public.fn_admin_testar_resumo_whatsapp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  _url text;
  _key text;
  _request_id bigint;
  _status int;
  _content text;
  _timeout_ms int := 30000;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer role admin';
  END IF;

  SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  -- Disparar requisição assíncrona e obter o request_id
  SELECT net.http_post(
    url := _url || '/functions/v1/whatsapp-resumo-ponto',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || _key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO _request_id;

  -- Aguardar a resposta (até 30s) consultando net._http_response
  FOR i IN 1..60 LOOP
    SELECT status_code, content
    INTO _status, _content
    FROM net._http_response
    WHERE id = _request_id;

    IF FOUND THEN EXIT; END IF;
    PERFORM pg_sleep(0.5);
  END LOOP;

  IF _status IS NULL THEN
    RETURN jsonb_build_object('error', 'timeout', 'request_id', _request_id);
  END IF;

  RETURN jsonb_build_object(
    'status', _status,
    'body', _content::jsonb
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.fn_admin_testar_resumo_whatsapp() TO authenticated;