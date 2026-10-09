CREATE OR REPLACE FUNCTION public.fn_planos_autorenew_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _t text;
  _is_auto boolean;
  _is_agreg boolean;
  _periodo int;
  _limite date;
BEGIN
  _t := lower(btrim(coalesce(NEW.tipo, '')));
  _is_agreg := _t LIKE '%gympass%' OR _t LIKE '%wellhub%' OR _t LIKE '%total pass%' OR _t LIKE '%totalpass%';
  _is_auto :=
    _t = 'start' OR _t LIKE 'start %' OR _t LIKE 'start-%'
    OR _is_agreg
    OR _t = 'vip' OR _t LIKE 'vip %' OR _t LIKE 'vip-%';

  IF _is_auto THEN
    NEW.renovacao_automatica := true;

    IF NEW.proxima_renovacao IS NULL AND NEW.data_inicio IS NOT NULL THEN
      NEW.proxima_renovacao := public.fn_proxima_renovacao_from(NEW.data_inicio);
    ELSIF NEW.proxima_renovacao IS NOT NULL AND NEW.data_inicio IS NOT NULL THEN
      _periodo := GREATEST(COALESCE(NEW.duracao_meses, 1), 1);
      _limite := (NEW.data_inicio + ((_periodo + 1) || ' months')::interval)::date;
      IF NEW.proxima_renovacao > _limite THEN
        NEW.proxima_renovacao := public.fn_proxima_renovacao_from(NEW.data_inicio);
      END IF;
    END IF;
  END IF;

  -- Planos mensais com renovação automática (exceto agregadoras):
  -- próxima renovação é sempre igual à data de término.
  IF NOT _is_agreg AND COALESCE(NEW.renovacao_automatica, false)
     AND COALESCE(NEW.duracao_meses, 1) = 1 THEN
    IF NEW.data_fim IS NULL THEN
      NEW.data_fim := COALESCE(NEW.proxima_renovacao,
        CASE WHEN NEW.data_inicio IS NOT NULL THEN (NEW.data_inicio + interval '1 month')::date END);
    END IF;
    NEW.proxima_renovacao := NEW.data_fim;
  END IF;

  RETURN NEW;
END;
$function$;