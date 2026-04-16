ALTER TABLE public.consumo_servicos 
ADD COLUMN tipo_registro text NOT NULL DEFAULT 'compra';

COMMENT ON COLUMN public.consumo_servicos.tipo_registro IS 'compra = crédito adquirido, uso_manual = uso manual registrado pelo admin';