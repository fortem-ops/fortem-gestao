ALTER TABLE public.pagamentos_rede
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_rede_pedido_id ON public.pagamentos_rede(pedido_id);

ALTER TABLE public.pagamentos_rede DROP CONSTRAINT IF EXISTS pagamentos_rede_alvo_check;
ALTER TABLE public.pagamentos_rede ADD CONSTRAINT pagamentos_rede_alvo_check
  CHECK (venda_id IS NOT NULL OR cobranca_id IS NOT NULL OR pedido_id IS NOT NULL);