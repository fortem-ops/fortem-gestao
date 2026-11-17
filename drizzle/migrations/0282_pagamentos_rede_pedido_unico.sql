CREATE UNIQUE INDEX IF NOT EXISTS uniq_pagamentos_rede_pedido_ativo ON public.pagamentos_rede (pedido_id)
WHERE pedido_id IS NOT NULL AND status IN ('approved','pending');