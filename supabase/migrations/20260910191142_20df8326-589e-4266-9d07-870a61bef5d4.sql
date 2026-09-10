ALTER TABLE public.pix_cobrancas ALTER COLUMN id_rec DROP NOT NULL;
ALTER TABLE public.pix_cobrancas ALTER COLUMN aluno_id DROP NOT NULL;
ALTER TABLE public.pix_cobrancas ALTER COLUMN data_vencimento DROP NOT NULL;
ALTER TABLE public.pix_cobrancas ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id);
ALTER TABLE public.pix_cobrancas ADD CONSTRAINT pix_cobrancas_origem_check
  CHECK (id_rec IS NOT NULL OR pedido_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pix_cobrancas_pedido_id ON public.pix_cobrancas(pedido_id);