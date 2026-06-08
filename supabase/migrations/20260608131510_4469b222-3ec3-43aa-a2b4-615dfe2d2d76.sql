
-- Função utilitária: calcula próximo aniversário mensal >= hoje a partir da data_inicio
CREATE OR REPLACE FUNCTION public.fn_proxima_renovacao_from(_data_inicio date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _today date := current_date;
  _next date := _data_inicio;
  _months int;
BEGIN
  IF _data_inicio IS NULL THEN
    RETURN NULL;
  END IF;
  IF _next > _today THEN
    RETURN _next;
  END IF;
  _months := ((extract(year from _today)::int - extract(year from _data_inicio)::int) * 12)
           + (extract(month from _today)::int - extract(month from _data_inicio)::int);
  _next := (_data_inicio + (_months || ' months')::interval)::date;
  WHILE _next <= _today LOOP
    _next := (_next + interval '1 month')::date;
  END LOOP;
  RETURN _next;
END;
$$;

-- Trigger: força renovacao_automatica + calcula proxima_renovacao para planos auto-renováveis
CREATE OR REPLACE FUNCTION public.fn_planos_autorenew_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IS NOT NULL AND (
    NEW.tipo ILIKE 'start%'
    OR NEW.tipo ILIKE '%gympass%'
    OR NEW.tipo ILIKE '%wellhub%'
    OR NEW.tipo ILIKE '%total%pass%'
  ) THEN
    NEW.renovacao_automatica := true;
    IF NEW.proxima_renovacao IS NULL AND NEW.data_inicio IS NOT NULL THEN
      NEW.proxima_renovacao := public.fn_proxima_renovacao_from(NEW.data_inicio);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planos_autorenew_defaults ON public.planos;
CREATE TRIGGER trg_planos_autorenew_defaults
BEFORE INSERT OR UPDATE ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.fn_planos_autorenew_defaults();

-- Backfill dos planos ativos existentes
UPDATE public.planos
SET renovacao_automatica = true,
    proxima_renovacao = COALESCE(proxima_renovacao, public.fn_proxima_renovacao_from(data_inicio))
WHERE ativo = true
  AND (
    tipo ILIKE 'start%'
    OR tipo ILIKE '%gympass%'
    OR tipo ILIKE '%wellhub%'
    OR tipo ILIKE '%total%pass%'
  )
  AND (renovacao_automatica = false OR proxima_renovacao IS NULL);
