CREATE OR REPLACE FUNCTION public.fn_proxima_renovacao_from(_data_inicio date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date := current_date;
  _next date := _data_inicio;
  _months int;
BEGIN
  IF _data_inicio IS NULL THEN
    RETURN NULL;
  END IF;
  -- Plano que ainda vai começar (ou começa hoje): a próxima renovação é
  -- o fim do primeiro ciclo, nunca o próprio dia de início.
  IF _next >= _today THEN
    RETURN (_next + interval '1 month')::date;
  END IF;
  _months := ((extract(year from _today)::int - extract(year from _data_inicio)::int) * 12)
           + (extract(month from _today)::int - extract(month from _data_inicio)::int);
  _next := (_data_inicio + (_months || ' months')::interval)::date;
  WHILE _next <= _today LOOP
    _next := (_next + interval '1 month')::date;
  END LOOP;
  RETURN _next;
END;
$function$;