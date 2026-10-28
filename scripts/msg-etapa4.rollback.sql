-- Rollback da etapa 4 do Disparo de Mensagens (migração 0207). Rodar só com aprovação do dono.
DROP FUNCTION IF EXISTS public.fn_msg_revalidar(uuid, text);
DROP FUNCTION IF EXISTS public.fn_msg_reservar_lote(uuid, int);
DROP FUNCTION IF EXISTS public.fn_msg_destinatarios(jsonb, jsonb);
ALTER TABLE public.msg_campanhas
  DROP COLUMN IF EXISTS total_preparado, DROP COLUMN IF EXISTS preparado_em, DROP COLUMN IF EXISTS confirmado_total,
  DROP COLUMN IF EXISTS confirmado_por, DROP COLUMN IF EXISTS confirmado_em, DROP COLUMN IF EXISTS lote_limite,
  DROP COLUMN IF EXISTS deduplicados;
DROP TABLE IF EXISTS public.msg_config;
-- O REVOKE de anon nas tabelas msg_* é higiene e não precisa ser desfeito (o app não as usa sem login).
