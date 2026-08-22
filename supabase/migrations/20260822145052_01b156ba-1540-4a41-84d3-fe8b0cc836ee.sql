-- 1. Controle de tentativas de cobrança automática
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_recusa text;

-- 2. pagamentos_rede passa a aceitar vínculo por cobrança
ALTER TABLE public.pagamentos_rede
  ALTER COLUMN venda_id DROP NOT NULL;

ALTER TABLE public.pagamentos_rede
  ADD COLUMN IF NOT EXISTS cobranca_id uuid REFERENCES public.cobrancas(id);

ALTER TABLE public.pagamentos_rede
  DROP CONSTRAINT IF EXISTS pagamentos_rede_alvo_check;

ALTER TABLE public.pagamentos_rede
  ADD CONSTRAINT pagamentos_rede_alvo_check
  CHECK (venda_id IS NOT NULL OR cobranca_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS pagamentos_rede_cobranca_idx
  ON public.pagamentos_rede (cobranca_id);

-- 3. Índices de apoio ao cron diário
CREATE INDEX IF NOT EXISTS cobrancas_vencimento_cobravel_idx
  ON public.cobrancas (data_vencimento)
  WHERE status IN ('pendente', 'atrasado');

CREATE INDEX IF NOT EXISTS idx_rede_tokenizacoes_cartao_salvo
  ON public.rede_tokenizacoes (cartao_salvo_id);

-- 4. Disparo WhatsApp para número fixo
ALTER TABLE public.whatsapp_disparos_config
  ADD COLUMN IF NOT EXISTS telefone_fixo text;

ALTER TABLE public.whatsapp_disparos_config
  DROP CONSTRAINT IF EXISTS whatsapp_disparos_config_destinatario_check;

ALTER TABLE public.whatsapp_disparos_config
  ADD CONSTRAINT whatsapp_disparos_config_destinatario_check
  CHECK (destinatario = ANY (ARRAY['aluno'::text, 'profissional'::text, 'consultor'::text, 'fixo'::text]));