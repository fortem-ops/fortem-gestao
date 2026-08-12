# Estorno Rede — erro de "Amount"

## O que os logs mostram

Logs mais recentes de `rede-cancelar`:

```text
2026-08-12T14:36:34Z INFO [rede-auth] novo access_token obtido, expira em 1439 segundos
2026-08-12T14:36:34Z INFO [rede-auth] obtendo token em: https://api.userede.com.br/redelabs/oauth2/token
2026-08-12T14:32:36Z ERROR OAuth Rede falhou (401): {"error":"invalid_client"}  (tentativa anterior, sandbox)
```

- A autenticação agora funciona (produção, token obtido às 14:36).
- **Não há nenhum log com status HTTP, `returnCode` ou `returnMessage` da Rede** — a função não registra a resposta do endpoint de estorno. Por isso o texto exato do erro "Amount" não aparece nos logs; ele chegou ao usuário apenas pelo toast do frontend.

## Causa provável (confirmada no código, não no log)

- `src/components/student/venda/HistoricoVendas.tsx` (linha 170) chama a função enviando apenas `{ tid, venda_id }` — **sem `amount`**.
- `supabase/functions/rede-cancelar/index.ts` monta o corpo como `{ amount: amount ? ... : undefined }`, o que serializa para `{}`.
- A API v2 da Rede exige `amount` (em centavos) no POST `/transactions/{tid}/refunds` — daí a mensagem sobre "Amount".

Isso explica o sintoma, mas o `returnCode`/`returnMessage` exatos só serão confirmados após adicionar log da resposta.

## Correção proposta

1. **Frontend** (`HistoricoVendas.tsx`): enviar `amount` no body do invoke, usando o valor da venda/pagamento aprovado correspondente ao TID (estorno total).
2. **Edge Function** (`rede-cancelar/index.ts`):
   - Se `amount` não vier no body, buscar o valor em `pagamentos_rede` pelo `tid` (fallback do servidor) e retornar 400 claro caso não encontre.
   - Sempre enviar `amount` em centavos no payload.
   - Adicionar `console.log` do status HTTP e do corpo da resposta da Rede (sem dados sensíveis), para que futuros erros apareçam nos logs.
   - Repassar `rede_http_status` e o corpo resumido na resposta de erro para o frontend.
3. **Teste**: reexecutar o estorno da venda `1824916f-9dbd-4570-99b1-91b6c8be9588` (tid `10472608121128082473`) e confirmar `returnCode: "00"` nos logs.

## Observação

O estorno de R$ 1,00 dessa venda ainda está pendente — a transação segue aprovada na Rede.
