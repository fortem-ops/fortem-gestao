CREATE OR REPLACE FUNCTION public.fn_planos_autorenew_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _t text;
  _is_auto boolean;
BEGIN
  _t := lower(btrim(coalesce(NEW.tipo, '')));
  _is_auto :=
    _t = 'start'
    OR _t LIKE 'start %'
    OR _t LIKE 'start-%'
    OR _t LIKE '%gympass%'
    OR _t LIKE '%wellhub%'
    OR _t LIKE '%total pass%'
    OR _t LIKE '%totalpass%'
    OR _t = 'vip'
    OR _t LIKE 'vip %'
    OR _t LIKE 'vip-%';

  IF _is_auto THEN
    NEW.renovacao_automatica := true;
    IF NEW.proxima_renovacao IS NULL AND NEW.data_inicio IS NOT NULL THEN
      NEW.proxima_renovacao := public.fn_proxima_renovacao_from(NEW.data_inicio);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.planos
SET renovacao_automatica = true,
    proxima_renovacao = COALESCE(proxima_renovacao, public.fn_proxima_renovacao_from(data_inicio))
WHERE ativo = true
  AND (lower(btrim(tipo)) = 'vip' OR lower(btrim(tipo)) LIKE 'vip %' OR lower(btrim(tipo)) LIKE 'vip-%')
  AND (renovacao_automatica = false OR proxima_renovacao IS NULL);