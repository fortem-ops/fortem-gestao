# Corrigir endpoints para e-Rede API v2

## Diagnóstico

A última tentativa retornou `{"message":"Requisição inválida."}` (HTTP 4xx, sem `returnCode` → salvou como `XX`). Isso confirma que `/redelabs/merchant/v1/transactions` não é o path correto.

Pesquisando a documentação oficial e o SDK PHP v2 da Rede (que usa OAuth 2.0 client_credentials, exatamente o nosso caso), os endpoints corretos são:

| Ambiente  | Transactions                                                  | OAuth Token                                                  |
|-----------|---------------------------------------------------------------|--------------------------------------------------------------|
| Produção  | `https://api.userede.com.br/erede/v2/transactions`            | `https://api.userede.com.br/redelabs/oauth2/token`           |
| Sandbox   | `https://sandbox-erede.useredecloud.com.br/v2/transactions`   | `https://rl7-sandbox-api.useredecloud.com.br/oauth2/token`   |

Ou seja: o path transacional continua sendo `/erede/v…/transactions` (v2 em vez de v1), e o auth é `Bearer <access_token>` da OAuth. O token Bearer **funciona** nesse endpoint v2; a API v1 que usávamos é que só aceitava Basic.

## Mudanças

### 1. `supabase/functions/rede-cobrar-cartao/index.ts` (linhas 5-9)

```ts
const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v2",
  producao: "https://api.userede.com.br/erede/v2",
};
```

### 2. `supabase/functions/_shared/rede-auth.ts` (linhas 31-33)

Corrigir o host de sandbox do OAuth — está faltando um hífen:

```ts
const authUrl = ambiente === "producao"
  ? "https://api.userede.com.br/redelabs/oauth2/token"
  : "https://rl7-sandbox-api.useredecloud.com.br/oauth2/token";
```

(A URL de produção já está correta — o `oauth_test` retornou OK.)

## Após o deploy

1. GET de diagnóstico — esperado: `bearer_test_body` com `returnCode` estruturado (ex.: 13 "amount inválido" no ping com query string), não mais 403 "Requisição inválida".
2. Cobrança real — esperado: `returnCode "00"` (sucesso) ou um código de recusa do emissor (05/51/etc.), com mensagem legível.

Nenhuma migration, nenhum secret novo.
