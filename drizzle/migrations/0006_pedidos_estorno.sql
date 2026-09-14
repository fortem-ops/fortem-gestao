ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_status_check CHECK (status = ANY (ARRAY['aguardando_pagamento'::text, 'pago'::text, 'cancelado'::text, 'expirado'::text, 'estornado'::text]));
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS estornado_em timestamptz;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS estornado_por uuid;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS estorno_detalhe jsonb;