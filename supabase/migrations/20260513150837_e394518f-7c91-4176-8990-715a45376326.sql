ALTER TABLE public.historico_profissional ADD COLUMN IF NOT EXISTS notificacao_id uuid;
CREATE INDEX IF NOT EXISTS idx_historico_notificacao ON public.historico_profissional(notificacao_id);