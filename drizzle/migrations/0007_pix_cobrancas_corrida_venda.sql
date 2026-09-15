ALTER TABLE public.pix_cobrancas
  ADD COLUMN IF NOT EXISTS corrida_venda_id uuid NULL REFERENCES public.vendas(id);

CREATE INDEX IF NOT EXISTS idx_pix_cobrancas_corrida_venda
  ON public.pix_cobrancas (corrida_venda_id)
  WHERE corrida_venda_id IS NOT NULL;