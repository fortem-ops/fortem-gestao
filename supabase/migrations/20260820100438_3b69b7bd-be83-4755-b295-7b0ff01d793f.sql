CREATE OR REPLACE FUNCTION public.cartoes_salvos_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.aluno_id IS DISTINCT FROM OLD.aluno_id THEN
    RAISE EXCEPTION 'aluno_id is immutable on cartoes_salvos';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.id := OLD.id;
    NEW.aluno_id := OLD.aluno_id;
    NEW.token_rede := OLD.token_rede;
    NEW.brand := OLD.brand;
    NEW.last4 := OLD.last4;
    NEW.holder_name := OLD.holder_name;
    NEW.expiration_month := OLD.expiration_month;
    NEW.expiration_year := OLD.expiration_year;
    NEW.origem := OLD.origem;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$function$;