CREATE UNIQUE INDEX IF NOT EXISTS uniq_pagamentos_rede_venda_ativa
  ON public.pagamentos_rede (venda_id)
  WHERE venda_id IS NOT NULL
    AND kind IN ('credit','token')
    AND status IN ('approved','pending');