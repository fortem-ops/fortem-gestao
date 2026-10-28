-- Rollback da etapa 2 do Disparo de Mensagens (opt-out e consulta de público).
DROP FUNCTION IF EXISTS public.fn_msg_publico(text[],text,text,boolean,boolean,integer,integer);
DROP FUNCTION IF EXISTS public.fn_msg_norm_tel(text);
DROP TABLE IF EXISTS public.msg_optout;
