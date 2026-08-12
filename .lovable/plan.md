# Estorno confirmado na Rede, mas não gravado no banco

## Logs (últimos 10 min)

```text
14:43:26 [rede-cancelar] estornando tid=10472608121128082473 amount=100 (centavos) ambiente=producao
14:43:26 [rede-auth] obtendo token em: https://api.userede.com.br/redelabs/oauth2/token
14:43:26 [rede-auth] novo access_token obtido, expira em 1439 segundos
14:43:27 [rede-cancelar] resposta Rede http=201 returnCode=359 returnMessage=Refund successful.
```

## Diagnóstico

O estorno **foi aprovado pela Rede**: HTTP 201, `returnCode 359`, `returnMessage "Refund successful."`.

A função só considera sucesso quando `returnCode === "00"`. Para estornos, a Rede devolve **359** (refund) — não 00. Consequências:

- `estornado = false` → nenhum update em `vendas` nem em `pagamentos_rede`.
- O banco confirma: `pagamentos_rede.status` continua `approved` (tid `10472608121128082473`, amount 100).
- O frontend recebeu `success: false` com `return_message: "Refund successful."` e exibiu esse texto no toast — por isso "pareceu sucesso" sendo, na verdade, um erro.

Ou seja: o dinheiro foi estornado na Rede, mas o sistema não registrou.

## Correção proposta

1. **`supabase/functions/rede-cancelar/index.ts`**
   - Considerar sucesso quando `returnCode` for `"00"` **ou** `"359"` (e aceitar HTTP 200/201 como faixa válida).
   - Manter o log atual da resposta da Rede.
2. **Reconciliar a venda de teste**: marcar `pagamentos_rede.status = 'refunded'` para o tid `10472608121128082473` e `vendas.status_pagamento = 'estornado'` para a venda `1824916f-9dbd-4570-99b1-91b6c8be9588`, já que o estorno realmente ocorreu na Rede.
3. **Frontend (`HistoricoVendas.tsx`)**: sem alteração necessária — passa a exibir sucesso corretamente assim que a função retornar `success: true`.

Escopo: uma edge function + uma atualização pontual de dados. Sem novos testes de cobrança na Rede.
