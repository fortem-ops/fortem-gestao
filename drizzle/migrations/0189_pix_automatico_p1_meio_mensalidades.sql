ALTER TABLE public.planos_2027_mensalidades
  ADD COLUMN meio text NOT NULL DEFAULT 'cartao',
  ADD COLUMN pix_recorrencia_id uuid REFERENCES public.pix_recorrencias(id),
  ADD COLUMN pix_cobranca_id uuid REFERENCES public.pix_cobrancas(id);
ALTER TABLE public.planos_2027_mensalidades ALTER COLUMN tokenizacao_id DROP NOT NULL;
ALTER TABLE public.planos_2027_mensalidades
  ADD CONSTRAINT planos_2027_mensalidades_meio_vinculos CHECK (
    (meio = 'cartao' AND tokenizacao_id IS NOT NULL AND pix_recorrencia_id IS NULL AND pix_cobranca_id IS NULL)
    OR (meio = 'pix_automatico' AND tokenizacao_id IS NULL)
  ),
  ADD CONSTRAINT planos_2027_mensalidades_pix_cobranca_unica UNIQUE (pix_cobranca_id);
CREATE INDEX idx_mensalidades_2027_pix_rec ON public.planos_2027_mensalidades (pix_recorrencia_id) WHERE pix_recorrencia_id IS NOT NULL;
COMMENT ON COLUMN public.planos_2027_mensalidades.meio IS 'cartao | pix_automatico. Rotinas do cartão devem considerar só meio=cartao antes de existir a 1ª linha Pix.';