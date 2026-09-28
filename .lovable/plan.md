# Regularizar mensalidades da Laura Ferrari Montemezzo

## Causa
O contrato Start+ da Laura (R$ 3.588/ano, 25/11/2025 a 03/12/2026) foi cadastrado sem venda de plano e com a forma de pagamento "pendente". Por isso nenhuma mensalidade foi gerada e a aba Pagamentos fica vazia.

## O que será feito (só no cadastro da Laura)
1. Ajustar o contrato para: pagamento mensal por cartão de crédito, 12 parcelas.
2. Criar as 12 mensalidades de R$ 299,00, com vencimento todo dia 25:
   - Ciclos 1 a 11 (25/11/2025 a 25/09/2026): **pagas**, cartão de crédito, data de pagamento = data do vencimento, com a observação "Regularização manual".
   - Ciclo 12 (25/10/2026): **pendente** (a vencer).
3. Antes de gravar, conferir de novo que ela não tem nenhuma cobrança, para não duplicar.
4. Depois, conferir no banco e na aba Pagamentos do perfil que as 12 aparecem.

## O que NÃO será feito
- Nenhuma cobrança real no cartão, nada é enviado à Rede.
- Nenhuma venda nova, nenhuma alteração em créditos, plano ou em outros alunos.
- Nenhuma mudança no programa.

## Detalhes técnicos
- `contratos` 7d35845c: `forma_pagamento='cartao_credito'`, `parcelas=12`.
- `cobrancas`: 12 linhas (contrato_id, aluno_id, numero_ciclo 1..12, valor 299, data_vencimento 25/mês), `meio_registro='manual'`; ciclos 1–11 `status='pago'`, `data_pagamento=data_vencimento`; ciclo 12 `status='pendente'`. Inserção guardada por `NOT EXISTS` no contrato.
- Observação: se o dia real do pagamento de cada mês for diferente do dia 25, as datas podem ser ajustadas depois.
