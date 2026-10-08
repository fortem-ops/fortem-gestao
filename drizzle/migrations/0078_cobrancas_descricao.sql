ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS descricao text;
COMMENT ON COLUMN public.cobrancas.descricao IS 'Identifica cobranças fora do ciclo (ex.: multa de cancelamento).';