ALTER TABLE public.pix_cobrancas DROP CONSTRAINT IF EXISTS pix_cobrancas_origem_check;

ALTER TABLE public.pix_cobrancas
  ADD CONSTRAINT pix_cobrancas_origem_check
  CHECK (id_rec IS NOT NULL OR pedido_id IS NOT NULL OR corrida_venda_id IS NOT NULL);