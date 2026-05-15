
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS renovacao_automatica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxima_renovacao date;

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

CREATE OR REPLACE FUNCTION public.fn_set_plano_renovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo IN ('Start', 'Gympass/Wellhub', 'Total Pass') THEN
    NEW.renovacao_automatica := true;
    IF NEW.proxima_renovacao IS NULL THEN
      NEW.proxima_renovacao := (NEW.data_inicio + interval '1 month')::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_plano_renovacao ON public.planos;
CREATE TRIGGER trg_set_plano_renovacao
  BEFORE INSERT OR UPDATE OF tipo, data_inicio
  ON public.planos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_plano_renovacao();

UPDATE public.planos
SET renovacao_automatica = true,
    proxima_renovacao = COALESCE(proxima_renovacao, (data_inicio + interval '1 month')::date)
WHERE ativo = true
  AND tipo IN ('Start', 'Gympass/Wellhub', 'Total Pass');
