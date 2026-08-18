CREATE OR REPLACE FUNCTION public.fn_admin_testar_resumo_whatsapp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  _result jsonb;
  _url text;
  _key text;
  _response record;
BEGIN
  -- Verificar admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: requer role admin';
  END IF;

  SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  SELECT
    status,
    content::jsonb
  INTO _response
  FROM net.http_post(
    url := _url || '/functions/v1/whatsapp-resumo-ponto',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || _key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS t(status int, content text);

  RETURN jsonb_build_object('status', _response.status, 'body', _response.content);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.fn_admin_testar_resumo_whatsapp() TO authenticated;