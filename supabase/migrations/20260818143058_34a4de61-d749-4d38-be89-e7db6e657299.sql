CREATE OR REPLACE FUNCTION public.fn_planos_autorenew_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _t text;
  _is_auto boolean;
  _periodo int;
  _limite date;
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
    ELSIF NEW.proxima_renovacao IS NOT NULL AND NEW.data_inicio IS NOT NULL THEN
      -- Salvaguarda: data de renovação muito além do ciclo do plano (ex.: +1 ano num
      -- plano mensal) faz o plano nunca entrar na fila diária de renovação.
      _periodo := GREATEST(COALESCE(NEW.duracao_meses, 1), 1);
      _limite := (NEW.data_inicio + ((_periodo + 1) || ' months')::interval)::date;
      IF NEW.proxima_renovacao > _limite THEN
        NEW.proxima_renovacao := public.fn_proxima_renovacao_from(NEW.data_inicio);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;