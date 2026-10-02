CREATE TABLE public.regras_categorizacao_fatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao text NOT NULL,
  categoria_id uuid NOT NULL REFERENCES public.despesas_categorias(id),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_categorizacao_fatura TO authenticated;
GRANT ALL ON public.regras_categorizacao_fatura TO service_role;
ALTER TABLE public.regras_categorizacao_fatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY coord_admin_all_regras_fatura ON public.regras_categorizacao_fatura FOR ALL TO authenticated
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());

CREATE TABLE public.cartoes_fatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  identificador_pdf text,
  dia_vencimento_padrao int CHECK (dia_vencimento_padrao BETWEEN 1 AND 31),
  forma_pagamento_padrao text,
  conta_bancaria text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_fatura TO authenticated;
GRANT ALL ON public.cartoes_fatura TO service_role;
ALTER TABLE public.cartoes_fatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY coord_admin_all_cartoes_fatura ON public.cartoes_fatura FOR ALL TO authenticated
  USING (public.is_coordenador_ou_admin()) WITH CHECK (public.is_coordenador_ou_admin());

ALTER TABLE public.despesas DROP CONSTRAINT despesas_forma_pagamento_check;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_forma_pagamento_check CHECK (forma_pagamento IS NULL OR forma_pagamento = ANY (ARRAY['PIX','BOLETO','DINHEIRO','CARTÃO DE DÉBITO','CARTÃO DE CRÉDITO','DÉBITO AUTOMÁTICO']));

INSERT INTO public.cartoes_fatura (nome, identificador_pdf, dia_vencimento_padrao, forma_pagamento_padrao, conta_bancaria)
VALUES ('Banco Inter','Banco Inter',10,'DÉBITO AUTOMÁTICO','BANCO INTER');

INSERT INTO public.regras_categorizacao_fatura (padrao, categoria_id, descricao) VALUES
('LOVABLE','aad1b82a-b3e7-4bba-ae91-4924adb6f75f','4.2 Lovable'),
('ANTHROPIC','3dda6206-cf2e-4454-8fe2-0d3eb71578eb','4.3 Claude'),
('CLAUDE SUB','3dda6206-cf2e-4454-8fe2-0d3eb71578eb','4.3 Claude'),
('TECNOFIT','d0bdbd42-b526-40f1-a34b-4ae12b321083','4.1 Tecnofit'),
('GODADDY','a5257f7b-b695-40ed-821b-f3026d57532f','4.6 Outras Assinaturas'),
('PIPEDRIVE','a5257f7b-b695-40ed-821b-f3026d57532f','4.6 Outras Assinaturas'),
('ADOBE','a5257f7b-b695-40ed-821b-f3026d57532f','4.6 Outras Assinaturas'),
('CANVA','a5257f7b-b695-40ed-821b-f3026d57532f','4.6 Outras Assinaturas'),
('KINOLOGY','a5257f7b-b695-40ed-821b-f3026d57532f','4.6 Outras Assinaturas'),
('FACEBK','3086bef2-42e9-4b81-87ca-ebe9e8764f83','5.1 Meta Ads'),
('GOOGLE ADS','679e92fc-1c9e-47f3-abe6-b0cb19204ae6','5.2 Google Ads'),
('OLYRA','1deaddcf-b0a4-4174-bccf-e6e8f97913a0','1.10 Aquisição para Infra'),
('MERCADOLIVRE','1deaddcf-b0a4-4174-bccf-e6e8f97913a0','1.10 Aquisição para Infra'),
('MERCADO*','1deaddcf-b0a4-4174-bccf-e6e8f97913a0','1.10 Aquisição para Infra'),
('AMAZONMKTPLC','1deaddcf-b0a4-4174-bccf-e6e8f97913a0','1.10 Aquisição para Infra'),
('OCEANOB2B','f6fbc949-4b01-40d5-93c7-179f7da7a1a9','1.12 Suprimentos'),
('FITNESSBRASIL','3ad18a72-eeb5-4961-ac8b-23aa54a8afe1','7.1 FitnessBrasil'),
('ZE DELIVERY','ee061b98-28c1-404a-9c4a-1aafad64766c','9.1 Aquisição/Fabricação'),
('ZÉ DELIVERY','ee061b98-28c1-404a-9c4a-1aafad64766c','9.1 Aquisição/Fabricação'),
('IOF','153afedf-cdf6-44d7-aa3a-3017f6b9a6ec','6.3 IOF');