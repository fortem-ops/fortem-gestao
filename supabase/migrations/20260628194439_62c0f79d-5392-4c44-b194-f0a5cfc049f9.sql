ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pis_pasep text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.cpf IS 'CPF do colaborador (somente dígitos, sem formatação).';
COMMENT ON COLUMN public.profiles.pis_pasep IS 'PIS/PASEP do colaborador (somente dígitos).';