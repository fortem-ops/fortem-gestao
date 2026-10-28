-- Rollback da etapa 3 do Disparo de Mensagens (migração 0206).
DROP TABLE IF EXISTS public.msg_testes;
DROP TABLE IF EXISTS public.msg_campanha_destinatarios;
DROP TABLE IF EXISTS public.msg_campanhas;
DROP FUNCTION IF EXISTS public.fn_msg_campanhas_touch();
ALTER TABLE public.msg_modelos DROP COLUMN IF EXISTS botao_url, DROP COLUMN IF EXISTS botao_texto, DROP COLUMN IF EXISTS botao_tipo;
