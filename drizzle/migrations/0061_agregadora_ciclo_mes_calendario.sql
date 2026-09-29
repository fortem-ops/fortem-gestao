CREATE OR REPLACE FUNCTION public.fn_is_agregadora(_tipo text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(_tipo, '') ~* '(gympass|wellhub|total ?pass)'
$$;

CREATE OR REPLACE FUNCTION public.fn_planos_agregadora_mes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ativo AND public.fn_is_agregadora(NEW.tipo) AND NEW.data_inicio IS NOT NULL THEN
    NEW.data_inicio := date_trunc('month', NEW.data_inicio)::date;
    NEW.data_fim := (date_trunc('month', NEW.data_inicio) + interval '1 month - 1 day')::date;
    NEW.proxima_renovacao := (date_trunc('month', NEW.data_inicio) + interval '1 month')::date;
    NEW.renovacao_automatica := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_planos_agregadora_mes ON public.planos;
CREATE TRIGGER trg_planos_agregadora_mes BEFORE INSERT OR UPDATE ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.fn_planos_agregadora_mes();

CREATE OR REPLACE FUNCTION public.fn_contratos_agregadora_mes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plano_id IS NOT NULL AND NEW.data_inicio IS NOT NULL
     AND NEW.status IN ('ativo','suspenso','inadimplente')
     AND EXISTS (SELECT 1 FROM public.planos p WHERE p.id = NEW.plano_id AND public.fn_is_agregadora(p.tipo)) THEN
    NEW.data_inicio := date_trunc('month', NEW.data_inicio)::date;
    NEW.data_fim := (date_trunc('month', NEW.data_inicio) + interval '1 month - 1 day')::date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contratos_agregadora_mes ON public.contratos;
CREATE TRIGGER trg_contratos_agregadora_mes BEFORE INSERT OR UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.fn_contratos_agregadora_mes();