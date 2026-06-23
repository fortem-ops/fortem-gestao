ALTER TABLE public.cartoes_salvos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'recepcao'
  CHECK (origem IN ('portal_aluno', 'link_cadastro', 'recepcao'));

COMMENT ON COLUMN public.cartoes_salvos.origem IS
  'Canal de cadastro do cartão: portal_aluno, link_cadastro ou recepcao';