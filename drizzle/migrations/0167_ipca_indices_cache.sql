CREATE TABLE public.ipca_indices (
  mes date PRIMARY KEY,
  variacao numeric(8,4) NOT NULL,
  fonte text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ipca_indices IS 'Cache do IPCA mensal (variação % do mês), usado só para exibir valor atualizado de mensalidades em atraso. Escrita apenas pela função ipca-atualizar.';
GRANT SELECT ON public.ipca_indices TO authenticated;
GRANT ALL ON public.ipca_indices TO service_role;
ALTER TABLE public.ipca_indices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IPCA leitura autenticada" ON public.ipca_indices FOR SELECT TO authenticated USING (true);