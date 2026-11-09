-- P1: parcelamento no link de pagamento (aditivo). Colunas nulas = comportamento atual.
ALTER TABLE public.links_pagamento
  ADD COLUMN IF NOT EXISTS parcelas_max integer NULL,
  ADD COLUMN IF NOT EXISTS parcelas_fixas boolean NULL;

ALTER TABLE public.links_pagamento
  ADD CONSTRAINT links_pagamento_parcelas_max_chk
  CHECK (parcelas_max IS NULL OR parcelas_max BETWEEN 1 AND 12);

COMMENT ON COLUMN public.links_pagamento.parcelas_max IS 'Máximo de parcelas no cartão escolhido pelo admin (1-12). NULL = usar vendas.parcelas, como antes.';
COMMENT ON COLUMN public.links_pagamento.parcelas_fixas IS 'true = cliente não escolhe, usa parcelas_max. NULL/false = cliente escolhe de 1 até parcelas_max.';
