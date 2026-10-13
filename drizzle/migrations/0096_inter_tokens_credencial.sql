ALTER TABLE public.inter_tokens ADD COLUMN IF NOT EXISTS credencial text;
COMMENT ON COLUMN public.inter_tokens.credencial IS 'Conjunto de credenciais Inter que emitiu o token (cob=INTER_COB_*, inter=INTER_*). Nulo = token antigo da integração de 22/06, ignorado pelo Pix Automático.';
CREATE INDEX IF NOT EXISTS idx_inter_tokens_credencial_exp ON public.inter_tokens (credencial, expires_at DESC);