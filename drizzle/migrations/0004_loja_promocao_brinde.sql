CREATE TABLE public.loja_promocao_brinde (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo BOOLEAN NOT NULL DEFAULT false,
  valor_minimo NUMERIC NOT NULL DEFAULT 249.00,
  data_fim DATE NOT NULL DEFAULT DATE '2026-09-27',
  brinde_1_nome TEXT NOT NULL DEFAULT 'Xícara de Café da Fortem',
  brinde_1_imagem_url TEXT,
  brinde_2_nome TEXT NOT NULL DEFAULT 'Garrafa de Vidro da Fortem',
  brinde_2_imagem_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loja_promocao_brinde TO anon;
GRANT SELECT, INSERT, UPDATE ON public.loja_promocao_brinde TO authenticated;
GRANT ALL ON public.loja_promocao_brinde TO service_role;

ALTER TABLE public.loja_promocao_brinde ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brinde_config_leitura_publica" ON public.loja_promocao_brinde
  FOR SELECT USING (true);

CREATE POLICY "brinde_config_gestao_coord_admin" ON public.loja_promocao_brinde
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

INSERT INTO public.loja_promocao_brinde (ativo) VALUES (false);

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS brinde_escolhido TEXT;