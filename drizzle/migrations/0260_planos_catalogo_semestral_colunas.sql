ALTER TABLE public.planos_catalogo ADD COLUMN IF NOT EXISTS agregadora_requerida text, ADD COLUMN IF NOT EXISTS preco_fixo_ciclos integer;
ALTER TABLE public.planos_catalogo ADD CONSTRAINT planos_catalogo_agregadora_requerida_check CHECK (agregadora_requerida IS NULL OR agregadora_requerida IN ('wellhub','totalpass'));
COMMENT ON COLUMN public.planos_catalogo.agregadora_requerida IS 'Item vendável só a aluno com plano ativo desta agregadora (Plano Semestral).';
COMMENT ON COLUMN public.planos_catalogo.preco_fixo_ciclos IS 'Número de ciclos com preço fixo a partir da venda.';