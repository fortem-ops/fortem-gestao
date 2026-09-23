# Regularizar contrato e pagamentos da Sofia Robin

## Causa
- A venda do Start+ (20/08/2026, R$ 4.788, recorrência mensal, cartão online) ficou **pendente** — o pagamento nunca foi registrado no sistema (nenhum registro de cartão na Rede para essa venda).
- Como o contrato de recorrência só nasce quando a primeira parcela é aprovada, ela ficou com **0 contratos e 0 cobranças** — por isso a aba Contrato está vazia.
- Ela tem 3 registros de plano Start+ (2 inativos, 1 ativo criado em 17/09 sem data de fim). É também por isso que ela aparece no Fiscal de Pipeline como "ganho sem contrato".

## O que será feito (só dados, nenhuma cobrança na Rede)
1. Conferir antes, só leitura: o valor mensal (R$ 4.788 / 12 = R$ 399) e o plano ativo certo (usar a função oficial de plano ativo).
2. Criar o contrato de recorrência com a função oficial já usada pelo sistema: início 20/08/2026, R$ 399/mês, cartão de crédito, primeira parcela marcada como paga.
3. Dar baixa manual na parcela de 20/09/2026 (cartão de crédito online), sem TID, como recebimento manual.
4. Marcar a venda como paga e ligar o plano ativo ao contrato (data de fim 20/08/2027).
5. Não gerar nenhuma cobrança nova nem mexer na trava da recorrência (continua desligada). A próxima parcela (20/10) fica em aberto.
6. Conferir o resultado no banco (contrato, 12 parcelas, 2 pagas) e na tela; rodar o Fiscal de Pipeline e resolver o alerta "ganho sem contrato" da Sofia.

## Ponto de atenção
Como os pagamentos foram feitos fora do sistema, não haverá número de transação (TID) nessas duas parcelas. Se você tiver os TIDs da Rede, posso gravá-los.

## Detalhes técnicos
- Venda 5121785d-998f-4a46-a5be-88c3818e5def; plano ativo 797981cc-...; aluno 580c7ac6-....
- `fn_criar_contrato_recorrencia(p_venda_id, p_aluno_id, p_plano_id, 399, 20, '2026-08-20', 'cartao_credito', null, true)` via run_sql (após SELECT de pré-checagem), depois update da cobrança do ciclo 2 para pago (tid null) e `vendas.status_pagamento='pago'`, respeitando idempotência (verificar antes que não existe contrato).
