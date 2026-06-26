
CREATE OR REPLACE FUNCTION public.fn_close_inadimplencia_on_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE public.inadimplencias
       SET status = 'regularizada',
           data_regularizacao = COALESCE(NEW.data_pagamento, CURRENT_DATE)
     WHERE cobranca_id = NEW.id
       AND status = 'aberta';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_inadimplencia_on_pagamento ON public.cobrancas;
CREATE TRIGGER trg_close_inadimplencia_on_pagamento
AFTER UPDATE OF status ON public.cobrancas
FOR EACH ROW
EXECUTE FUNCTION public.fn_close_inadimplencia_on_pagamento();

REVOKE EXECUTE ON FUNCTION public.fn_close_inadimplencia_on_pagamento() FROM PUBLIC, anon;

-- Regulariza inadimplências históricas cujas cobranças já foram pagas
UPDATE public.inadimplencias i
   SET status = 'regularizada',
       data_regularizacao = COALESCE(c.data_pagamento, CURRENT_DATE)
  FROM public.cobrancas c
 WHERE i.cobranca_id = c.id
   AND c.status = 'pago'
   AND i.status = 'aberta';
