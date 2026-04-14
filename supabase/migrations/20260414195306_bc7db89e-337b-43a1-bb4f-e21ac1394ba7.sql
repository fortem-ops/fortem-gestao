ALTER TABLE public.consumo_servicos
ADD COLUMN quantidade integer NOT NULL DEFAULT 1,
ADD COLUMN valor_unitario numeric NOT NULL DEFAULT 0;