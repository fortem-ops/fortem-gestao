-- Rollback da etapa 1 do Disparo de Mensagens (tabela de modelos).
DROP TRIGGER IF EXISTS trg_msg_modelos_touch ON public.msg_modelos;
DROP FUNCTION IF EXISTS public.fn_msg_modelos_touch();
DROP TABLE IF EXISTS public.msg_modelos;
