# Venda paga no cartão parcelado = todas as parcelas pagas

## O que foi confirmado

- A venda do Matheus Rigoni (Power 2x, R$ 5.148,00, cartão de crédito em 12x) está como **Paga**. As 12 parcelas de R$ 429,00 em Cobranças continuam **Pendente**.
- **Causa:** dar baixa numa cobrança marca a venda como paga. Mas marcar a venda como paga, ou criá-la já paga, não mexe nas cobranças.
- Levantei os últimos 60 dias: 18 vendas pagas ainda têm cobranças em aberto. Só a do Matheus está registrada como **cartão parcelado**. As outras 17 são de mensalidades pagas mês a mês, sem modalidade definida, ou de recorrência. Elas já têm 1 a 9 parcelas quitadas ao longo dos meses, então as pendentes delas são cobranças futuras de verdade e **não devem** ser marcadas como pagas.

## Regra proposta

- Quando uma venda com modalidade **cartão em até 12x** ou **pagamento à vista** (cartão, Pix ou dinheiro) fica Paga (na criação ou ao mudar o status), todas as parcelas pendentes ou atrasadas daquele contrato passam a **Pago**, com a data da venda.
- Recorrência, mensalidades e vendas sem modalidade definida continuam como hoje: só a parcela paga recebe baixa.
- Multas de cancelamento, cobranças canceladas e cobranças já pagas não mudam.
- Se a venda voltar a Pendente, nada é desfeito automaticamente.

## Acerto dos casos antigos

- Apenas o Matheus: 12 parcelas, R$ 5.148,00, passam a Pago com a data 16/10/2026. Antes, faço um backup para poder desfazer.

## Detalhes técnicos

- Trigger `AFTER INSERT OR UPDATE OF status_pagamento ON vendas`, quando passa para `pago` e `modalidade_pagamento in ('cartao_parcelado','cartao_credito','pix_avista','pix','dinheiro')`. O contrato vem por `cobranca_id` ou pelo mais recente de `aluno_id + plano_id`. Faz `UPDATE cobrancas SET status='pago', data_pagamento=data_venda` onde `status in ('pendente','atrasado')` e `numero_ciclo<>999`, e registra em `system_logs`.
- Não chama Inter nem Rede. É idempotente.
- Backup em `scripts/baixa-venda-parcelada.backup.sql`, com rollback.
- Teste da regra: parcelado zera as pendências; venda com modalidade "pendente" não muda nada.
- Não mexe em Planos 1 e 2, nas flags, na recorrência nem nos contratos.
