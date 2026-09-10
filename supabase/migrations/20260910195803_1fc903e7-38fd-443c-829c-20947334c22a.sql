CREATE TABLE public.inter_cob_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.inter_cob_tokens TO service_role;

ALTER TABLE public.inter_cob_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inter_cob_tokens_expires_at ON public.inter_cob_tokens (expires_at DESC);