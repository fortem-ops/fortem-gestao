-- VOLTA: restaura assinatura e corpo anteriores (4 argumentos) e a linha do e-mail.
DROP FUNCTION public.fn_checkout_2027_pagamento_iniciar(uuid, text, text, text, int);
-- Recriar fn_checkout_2027_pagamento_iniciar(uuid,text,text,text) com o corpo original
-- (idêntico ao da proposta, sem p_parcelas, sem a validação de parcelas, e com a comparação
--  OR (c->>'parcelas_plano') IS DISTINCT FROM (r.revisao->>'parcelas_plano') para todas as formas),
-- REVOKE de PUBLIC/anon/authenticated e GRANT EXECUTE a service_role.
-- fn_checkout_2027_email_dados: voltar 'parcelas', coalesce(r.parcelas_plano, 1).
