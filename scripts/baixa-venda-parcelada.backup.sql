-- Backup/rollback: cobranças do contrato 58a5382d (Matheus Rigoni) antes da baixa automática, 16/10/2026
-- Rollback trigger: DROP TRIGGER IF EXISTS trg_venda_paga_baixa_cobrancas ON public.vendas; DROP FUNCTION IF EXISTS public.fn_venda_paga_baixa_cobrancas();
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='3fdfb287-0163-42e2-aada-9f0b02ab9752';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='e5febf36-d67b-43d5-9922-11ca6c0208fc';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='ce1a2346-2dfa-483b-b252-750d3882358c';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='4eb0d9a7-3458-4a0b-879f-b5c2bcb4c843';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='aecd88d1-4acd-4aa2-8d8a-7c3d94bc9f9e';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='1e037227-3960-4b6d-91d4-1a1c85b6c70d';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='4efce6b1-b84b-4e56-92e2-c9b54696af1f';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='dced5e28-1363-466e-94d7-f01f2f78aef3';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='28673a93-b738-4009-9f36-223b53c76258';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='5f50ffec-439e-4429-9cf8-ffc0a53fba6a';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='3ded57c9-6b29-4922-88f5-6e1af01c9868';
UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL WHERE id='bfdcc4d5-b2c0-4ed9-ac7d-460d8e388898';
