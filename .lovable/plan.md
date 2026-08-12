# Relatório de estado atual — Fluxo de Tokenização de Bandeira Rede

## 1. Edge Functions do fluxo

| Function | Papel no fluxo | Estado observado |
|---|---|---|
| `rede-salvar-cartao` | Recebe dados do cartão, solicita tokenização de bandeira (`POST /token-service/oauth/v2/tokenization` com `storageCard: "2"` e `embeddedZeroDollar: true`), grava registro `pending` em `rede_tokenizacoes` e retorna status "pending" para o frontend. | Implementado com novo fluxo; fluxo antigo (Zero Dollar + `brandTid`) está comentado/inalcançável. |
| `rede-tokenizacao-webhook` | Recebe notificações da Rede, valida `Authorization: Bearer REDE_WEBHOOK_TOKEN`, consulta status da tokenização, atualiza `rede_tokenizacoes` e, quando `Active`, insere o cartão em `cartoes_salvos` usando `token_code`, `brand_name`, `last4`, `cardholder_name` e validade parseada de `token_expiration`. | Implementado e já deployado. |
| `rede-cobrar-token` | Cobrança usando cartão salvo. Atualmente envia `storageCard: "2"` + `brandTid: cartao.token_rede` + dados de validade/titular para `/v2/transactions`. | **AINDA NO FORMATO ANTIGO** — usa `brandTid` (campo `token_rede` do cartão) e NÃO usa `tokenCryptogram`. |
| `rede-cobrar-cartao` | Cobrança com cartão digitado (PAN completo). Não faz parte do fluxo de tokenização de bandeira. | Inalterado. |
| `rede-webhook` | Webhook genérico de transações da Rede. Não é o webhook de tokenização. | Inalterado. |
| `rede-cancelar` | Estorno de transações. | Inalterado. |

Não existe hoje uma Edge Function separada para "geração de criptograma" ou "consulta de status". A consulta de status é feita dentro do próprio `rede-tokenizacao-webhook`.

## 2. URL pública do webhook de tokenização

A function `rede-tokenizacao-webhook` já está deployada e respondendo. Teste realizado com token inválido retornou **HTTP 401** (`{"error":"Não autorizado"}`), confirmando que a validação do `REDE_WEBHOOK_TOKEN` está ativa.

URL para cadastrar no portal da Rede:

```
https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/rede-tokenizacao-webhook
```

## 3. Estado da cobrança (`rede-cobrar-token`)

A função `rede-cobrar-token` **ainda não foi migrada para o novo formato de tokenização de bandeira**. O payload atual é:

```json
{
  "capture": true,
  "kind": "credit",
  "reference": "...",
  "amount": ...,
  "installments": ...,
  "storageCard": "2",
  "brandTid": "<valor de cartoes_salvos.token_rede>",
  "expirationMonth": "...",
  "expirationYear": "...",
  "cardholderName": "...",
  "subscription": true
}
```

Ou seja, ela continua usando `brandTid` (que sabemos que não funciona no novo fluxo). Para o novo produto "Tokenização de Bandeira", a cobrança provavelmente precisará usar `token_code` + `tokenCryptogram` (criptograma gerado previamente) ou outro campo específico da documentação v2 da Rede.

## 4. Etapas pendentes antes do teste ponta a ponta

1. **Cadastrar a URL do webhook no portal da Rede** (vender online > e-Commerce > tokenização de bandeira > cadastro de URL) usando a URL acima e o secret `REDE_WEBHOOK_TOKEN` já configurado.
2. **Confirmar o mapeamento de campos da Rede** para tokenização de bandeira, especialmente:
   - Se `token.code` é realmente o campo correto para reutilizar como `token_rede`.
   - Se a cobrança futura exige `tokenCryptogram` e, se sim, como gerá-lo (pode exigir nova chamada ao Token Service ou endpoint específico da Rede).
3. **Atualizar `rede-cobrar-token`** para usar o formato correto de cobrança com tokenização de bandeira (`token_code` + `tokenCryptogram` + `storageCard: "2"`), em vez de `brandTid`.
4. **Testar o fluxo completo:** cadastrar cartão → receber webhook → confirmar cartão salvo em `cartoes_salvos` → tentar cobrança via `rede-cobrar-token`.

## Observações

- A coluna `cardholder_name` já existe em `rede_tokenizacoes` (o ALTER TABLE já foi aplicado).
- O secret `REDE_WEBHOOK_TOKEN` já está configurado e disponível.
- O fluxo de salvamento (`rede-salvar-cartao`) já persiste o `cardholder_name` no registro de tokenização.
