
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS aluno_2025 boolean NOT NULL DEFAULT false;

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tipo_cobranca text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS taxa_mensal numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS modalidade_pagamento text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS canal_pagamento text;

ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_tipo_cobranca_check;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_tipo_cobranca_check
  CHECK (tipo_cobranca IS NULL OR tipo_cobranca IN ('recorrencia','tradicional'));

ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_canal_pagamento_check;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_canal_pagamento_check
  CHECK (canal_pagamento IS NULL OR canal_pagamento IN ('maquininha','online','manual'));
