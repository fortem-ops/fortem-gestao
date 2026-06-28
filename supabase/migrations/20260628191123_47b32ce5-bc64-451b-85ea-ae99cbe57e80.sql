ALTER TABLE public.ponto_configuracoes
  ADD COLUMN IF NOT EXISTS banco_horas_validade_meses integer DEFAULT NULL;

COMMENT ON COLUMN public.ponto_configuracoes.banco_horas_validade_meses IS
  'Validade do saldo positivo do banco de horas em meses. NULL = sem expiração.';