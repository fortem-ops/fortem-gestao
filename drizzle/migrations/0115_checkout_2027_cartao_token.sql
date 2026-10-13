ALTER TABLE public.rede_tokenizacoes ALTER COLUMN aluno_id DROP NOT NULL;
ALTER TABLE public.rede_tokenizacoes ADD CONSTRAINT rede_tok_dono_chk CHECK (aluno_id IS NOT NULL OR proposta_id IS NOT NULL) NOT VALID;
ALTER TABLE public.rede_tokenizacoes VALIDATE CONSTRAINT rede_tok_dono_chk;

ALTER TABLE public.pagamentos_rede DROP CONSTRAINT pagamentos_rede_alvo_check;
ALTER TABLE public.pagamentos_rede ADD CONSTRAINT pagamentos_rede_alvo_check
  CHECK (venda_id IS NOT NULL OR cobranca_id IS NOT NULL OR pedido_id IS NOT NULL OR proposta_id IS NOT NULL);
CREATE UNIQUE INDEX uniq_pagamentos_rede_proposta_aprovado ON public.pagamentos_rede (proposta_id)
  WHERE proposta_id IS NOT NULL AND status = 'approved';

ALTER TABLE public.checkout_2027_tentativas DROP CONSTRAINT checkout_2027_tentativas_status_check;
ALTER TABLE public.checkout_2027_tentativas ADD CONSTRAINT checkout_2027_tentativas_status_check
  CHECK (status = ANY (ARRAY['pendente','aprovado','recusado','expirado','processando','desconhecido']));
ALTER TABLE public.checkout_2027_tentativas
  ADD COLUMN IF NOT EXISTS tokenizacao_id uuid,
  ADD COLUMN IF NOT EXISTS consultado_em timestamptz,
  ADD COLUMN IF NOT EXISTS bandeira text,
  ADD COLUMN IF NOT EXISTS final_cartao text;
CREATE UNIQUE INDEX uniq_checkout_2027_cartao_processando ON public.checkout_2027_tentativas (proposta_id)
  WHERE tipo = 'cartao' AND status IN ('processando','desconhecido');

ALTER TABLE public.propostas_planos_2027
  ADD COLUMN IF NOT EXISTS pagamento_parcelas smallint,
  ADD COLUMN IF NOT EXISTS pagamento_nsu text,
  ADD COLUMN IF NOT EXISTS pagamento_tid_mascarado text;