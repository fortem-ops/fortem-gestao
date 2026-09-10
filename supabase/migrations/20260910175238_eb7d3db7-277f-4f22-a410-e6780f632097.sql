ALTER TABLE public.produtos_variantes ADD COLUMN IF NOT EXISTS imagem_url text;
ALTER TABLE public.produtos_variantes ADD COLUMN IF NOT EXISTS cor_hex text;