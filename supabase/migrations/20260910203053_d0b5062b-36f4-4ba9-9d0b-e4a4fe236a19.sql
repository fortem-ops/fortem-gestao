ALTER TABLE public.rede_tokenizacoes
  ADD COLUMN IF NOT EXISTS link_cartao_id uuid REFERENCES public.links_cartao(id);

CREATE INDEX IF NOT EXISTS idx_rede_tokenizacoes_link_cartao
  ON public.rede_tokenizacoes(link_cartao_id);