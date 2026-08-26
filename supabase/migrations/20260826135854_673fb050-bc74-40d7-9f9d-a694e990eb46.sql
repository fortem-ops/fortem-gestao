ALTER TABLE public.planos DROP CONSTRAINT IF EXISTS planos_tipo_check;

CREATE OR REPLACE FUNCTION public.fn_planos_validar_tipo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  legado text[] := ARRAY[
    'Start','Start+','Power','Pro','Max','Gympass/Wellhub','Total Pass',
    'VIP','VIP Livre','VIP 1x/semana','VIP 2x/semana','VIP 3x/semana',
    'VIP 4x/semana','VIP 5x/semana','VIP 6x/semana','VIP 7x/semana'
  ];
BEGIN
  IF NEW.tipo IS NULL OR btrim(NEW.tipo) = '' THEN
    RAISE EXCEPTION 'Tipo de plano não informado.';
  END IF;

  IF NEW.tipo = ANY (legado) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.planos_catalogo c
    WHERE c.atividade = NEW.atividade
      AND (NEW.tipo = c.nome OR NEW.tipo LIKE c.nome || ' %')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Plano "%" não encontrado no catálogo para a atividade "%". Cadastre-o no catálogo de planos antes de lançar a venda.', NEW.tipo, NEW.atividade;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_planos_validar_tipo ON public.planos;
CREATE TRIGGER trg_planos_validar_tipo
BEFORE INSERT OR UPDATE OF tipo, atividade ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.fn_planos_validar_tipo();