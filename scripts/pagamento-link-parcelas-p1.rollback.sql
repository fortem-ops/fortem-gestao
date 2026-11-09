-- Rollback P1: só remove se nenhum link usa as colunas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.links_pagamento WHERE parcelas_max IS NOT NULL OR parcelas_fixas IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback abortado: há links usando parcelas_max/parcelas_fixas';
  END IF;
  ALTER TABLE public.links_pagamento DROP CONSTRAINT IF EXISTS links_pagamento_parcelas_max_chk;
  ALTER TABLE public.links_pagamento DROP COLUMN IF EXISTS parcelas_fixas;
  ALTER TABLE public.links_pagamento DROP COLUMN IF EXISTS parcelas_max;
END $$;
