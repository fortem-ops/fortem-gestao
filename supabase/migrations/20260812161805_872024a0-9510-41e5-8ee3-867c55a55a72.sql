CREATE TABLE public.rate_limit_corrida_publico (
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  janela_min bigint NOT NULL,
  contagem integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_address, endpoint, janela_min)
);

GRANT ALL ON public.rate_limit_corrida_publico TO service_role;

ALTER TABLE public.rate_limit_corrida_publico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_corrida_publico_admin_select"
ON public.rate_limit_corrida_publico
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));