ALTER TABLE public.servicos_catalogo
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS versao integer,
  ADD COLUMN IF NOT EXISTS custo_repasse_unitario jsonb,
  ADD COLUMN IF NOT EXISTS validade_meses integer,
  ADD COLUMN IF NOT EXISTS sobrevive_cancelamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS composicao jsonb,
  ADD COLUMN IF NOT EXISTS gera_pendencia_comissao boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendavel_desde date,
  ADD COLUMN IF NOT EXISTS vendavel_ate date;
CREATE UNIQUE INDEX IF NOT EXISTS servicos_catalogo_codigo_uk ON public.servicos_catalogo(codigo) WHERE codigo IS NOT NULL;