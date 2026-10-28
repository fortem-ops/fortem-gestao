-- Rollback da 0211 (filtro "Cliente desde" no Público). Rodar só com aprovação do dono.
-- 1) Remove a assinatura nova de fn_msg_publico e recria a anterior (corpo da 0205/0207, sem cliente_desde).
DROP FUNCTION IF EXISTS public.fn_msg_publico(text[], text, text, boolean, boolean, integer, integer, date, date);
-- Recriar fn_msg_publico(text[], text, text, boolean, boolean, integer DEFAULT 50, integer DEFAULT 0)
-- copiando o corpo de drizzle/migrations/0205_msg_optout_publico.sql (ou da última migração que a alterou),
-- e reaplicar: REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role;
-- 2) fn_msg_destinatarios: recriar com o corpo de drizzle/migrations/0207_msg_etapa4.sql (sem clienteDesdeDe/Ate).
--    As chaves extras no filtro das campanhas são ignoradas pelo corpo antigo.
-- 3) Função auxiliar:
DROP FUNCTION IF EXISTS public.fn_cliente_desde(uuid);
