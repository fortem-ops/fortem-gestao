ALTER TABLE public.ponto_fechamentos_mensais
  ADD COLUMN IF NOT EXISTS ciencia_colaborador_em timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ciencia_colaborador_ip text DEFAULT NULL;

COMMENT ON COLUMN public.ponto_fechamentos_mensais.ciencia_colaborador_em IS
  'Timestamp em que o colaborador declarou ciência do espelho de ponto (Portaria MTE 671/2021).';
COMMENT ON COLUMN public.ponto_fechamentos_mensais.ciencia_colaborador_ip IS
  'IP/origem registrado no momento da ciência do colaborador.';