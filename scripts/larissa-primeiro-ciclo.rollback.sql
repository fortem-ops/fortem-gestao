-- Reversão SOMENTE da regularização pontual de 20/10/2026. Não executado.
-- Não estorna nem recobra. Interrompe se qualquer registro financeiro divergir.
BEGIN;
DO $rollback$
DECLARE c public.cobrancas; v public.vendas; p public.pagamentos_rede; cc public.ciclos_credito;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:8bfa4dea-faba-44c1-8f5e-70df0fa535da',0));
  SELECT * INTO v FROM public.vendas WHERE id='8bfa4dea-faba-44c1-8f5e-70df0fa535da' FOR UPDATE;
  SELECT * INTO c FROM public.cobrancas WHERE id='c62a0a8a-4b72-4262-9ad3-9c2c3824bf20' FOR UPDATE;
  SELECT * INTO p FROM public.pagamentos_rede WHERE id='7cc52cc7-66fa-466c-b77e-1ad646487223' FOR UPDATE;
  SELECT * INTO cc FROM public.ciclos_credito WHERE id='ea50f3ff-2598-426d-b6ae-755c36580b90' FOR UPDATE;
  IF c.id IS NULL OR v.id IS NULL OR p.id IS NULL OR cc.id IS NULL
    OR c.status IS DISTINCT FROM 'pago' OR c.valor IS DISTINCT FROM 403::numeric
    OR c.data_pagamento IS DISTINCT FROM DATE '2026-10-20' OR c.gateway IS DISTINCT FROM 'Rede'
    OR c.tid IS DISTINCT FROM '10472610201229413568'
    OR c.contrato_id IS DISTINCT FROM '9cb790f2-fbba-41e9-a20f-d23c63cf8bef'::uuid
    OR c.aluno_id IS DISTINCT FROM 'f4ff7ece-7fad-49ca-aa8f-2f18494abf03'::uuid
    OR v.status_pagamento IS DISTINCT FROM 'pago' OR v.valor_final IS DISTINCT FROM 403::numeric
    OR v.cobranca_id IS DISTINCT FROM c.id OR p.cobranca_id IS DISTINCT FROM c.id
    OR p.venda_id IS DISTINCT FROM v.id OR p.status IS DISTINCT FROM 'approved'
    OR p.amount IS DISTINCT FROM 40300 OR p.tid IS DISTINCT FROM c.tid OR p.nsu IS DISTINCT FROM '502906899'
    OR cc.contrato_id IS DISTINCT FROM c.contrato_id OR cc.cobranca_id IS DISTINCT FROM c.id
  THEN RAISE EXCEPTION 'Reversão abortada: estado divergente'; END IF;
  UPDATE public.pagamentos_rede SET cobranca_id=NULL WHERE id=p.id;
  UPDATE public.vendas SET cobranca_id=NULL WHERE id=v.id;
  UPDATE public.ciclos_credito SET cobranca_id=NULL WHERE id=cc.id;
  UPDATE public.cobrancas SET status='pendente', data_pagamento=NULL, gateway=NULL, tid=NULL WHERE id=c.id;
  INSERT INTO public.system_logs(modulo,acao,mensagem,payload)
  VALUES ('cobrancas','reversao_regularizacao_primeiro_ciclo','Reversão do vínculo e baixa pontual aprovada; pagamento Rede preservado',
    jsonb_build_object('venda_id',v.id,'pagamento_id',p.id,'cobranca_id',c.id,'ciclo_id',cc.id,'sem_estorno',true));
END $rollback$;
COMMIT;