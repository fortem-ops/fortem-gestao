ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS chave_pix text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS pix_codigo_solicitacao text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS pix_status text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS pix_erro text;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_pix_status_check CHECK (pix_status IS NULL OR pix_status IN ('AGUARDANDO_ENVIO','AGUARDANDO_APROVACAO','CONCLUIDO','REJEITADO','ERRO'));
CREATE INDEX IF NOT EXISTS idx_despesas_pix_status ON public.despesas(pix_status) WHERE pix_status IS NOT NULL;