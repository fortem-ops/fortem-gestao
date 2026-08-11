CREATE TABLE public.rate_limit_corrida_cpf (
  ip_address text NOT NULL,
  janela_min bigint NOT NULL,
  contagem integer NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_address, janela_min)
);

GRANT ALL ON public.rate_limit_corrida_cpf TO service_role;

ALTER TABLE public.rate_limit_corrida_cpf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_corrida_cpf_service_only"
ON public.rate_limit_corrida_cpf
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);