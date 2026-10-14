ALTER TABLE public.cobrancas DROP CONSTRAINT cobrancas_meio_registro_check;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_meio_registro_check
  CHECK (meio_registro = ANY (ARRAY['automatico'::text, 'manual_admin'::text, 'gateway_webhook'::text, 'site_2027'::text]));