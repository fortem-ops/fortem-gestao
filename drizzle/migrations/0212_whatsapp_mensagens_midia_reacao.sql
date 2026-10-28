ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS reacao_a_wamid text,
  ADD COLUMN IF NOT EXISTS media_id text,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_mime text;
CREATE INDEX IF NOT EXISTS whatsapp_mensagens_reacao_idx ON public.whatsapp_mensagens (reacao_a_wamid) WHERE reacao_a_wamid IS NOT NULL;