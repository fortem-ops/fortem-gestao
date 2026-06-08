
-- 1. Trigger refinada: Start (sem o '+') / Gympass / Wellhub / Total Pass
CREATE OR REPLACE FUNCTION public.fn_planos_autorenew_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    OR _t LIKE '%totalpass%';

  IF _is_auto THEN
    NEW.renovacao_automatica := true;
    IF NEW.proxima_renovacao IS NULL AND NEW.data_inicio IS NOT NULL THEN
      NEW.proxima_renovacao := public.fn_proxima_renovacao_from(NEW.data_inicio);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Reverter Start+ que foi marcado erroneamente no backfill anterior
UPDATE public.planos
SET renovacao_automatica = false,
    proxima_renovacao = NULL
WHERE ativo = true
  AND lower(btrim(tipo)) LIKE 'start+%';
