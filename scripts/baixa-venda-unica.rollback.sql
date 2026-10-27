-- Rollback: baixa de cobrança única por venda paga com modalidade "pendente" (27/10/2026)
-- 1) Dado: cobrança ciclo 1 do contrato 941511cd volta a pendente
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='eb99f244-0fe0-453f-99e7-2a5b935bbabf';
-- 2) Regra: reaplicar a versão anterior de public.fn_venda_paga_baixa_cobrancas
--    (igual à atual, sem o ramo "_unica"; modalidades aceitas: cartao_parcelado, cartao_credito, pix_avista, dinheiro).
