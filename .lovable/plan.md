Se a Rede confirmou que o PV `96337443` está habilitado para e-commerce, o erro 370 vira muito provavelmente um problema de **forma de autenticação na transação** ou de **fluxo (capture/permissão do token OAuth)**. Plano de investigação técnica, sem mexer em cadastro.

## Hipóteses ordenadas por probabilidade

1. **Autenticação errada no `/transactions`**
   A API e-Rede clássica (`/erede/v1/transactions`) historicamente usa **Basic Auth com `PV:Token`**, não Bearer OAuth. O OAuth (`/redelabs/oauth2/token`) pertence ao produto Rede Labs / APIs novas, que muitas vezes usam outra base (`/redelabs/...`) — não `/erede/v1`. Mandar Bearer num endpoint que espera Basic pode resultar em 500 + 370 genérico em vez de 401.

2. **Base URL incompatível com o tipo de credencial**
   - Se as credenciais são “e-Rede tradicionais” (PV + Chave de Integração antiga) → endpoint correto é `https://api.userede.com.br/erede/v1/transactions` com **Basic Auth**.
   - Se são credenciais Rede Labs (client_id/client_secret OAuth) → endpoint costuma ser outro, dentro de `/redelabs/...`.
   Hoje estamos misturando: pegando token via OAuth Rede Labs e batendo em `/erede/v1` com Bearer.

3. **`capture: true` não permitido nesse fluxo**
   Teste controlado com `capture: false` (só autorização) ajuda a isolar se o problema é captura automática.

4. **Cartão real recusado genericamente**
   Testar com outro cartão de bandeira diferente (Visa vs Master) para descartar problema do plástico/emissor.

## Passos de diagnóstico propostos (sem alterar cadastro)

### Passo A — Tentar Basic Auth direto no `/transactions`
Adicionar um modo de teste na edge function `rede-cobrar-cartao` (ou um endpoint de diagnóstico GET) que faça **uma** chamada de R$ 1,00 usando:

```
Authorization: Basic base64(PV + ":" + Token)
```

mantendo `POST https://api.userede.com.br/erede/v1/transactions` e o mesmo payload atual. Comparar resposta com a chamada Bearer atual.

### Passo B — Testar `capture: false`
Mesma cobrança, com `capture: false`. Se autorizar, o problema é captura automática / permissão de captura.

### Passo C — Confirmar qual produto a Rede ativou
Perguntar à Rede explicitamente:
- “O PV está habilitado em **e-Rede (API clássica `/erede/v1`)** ou em **Rede Labs (OAuth `/redelabs`)**?”
- “Para transacionar, devo usar **Basic Auth PV:Chave** ou **Bearer OAuth**?”
- “Qual a URL transacional correta para esse PV?”

Isso decide se mantemos o fluxo OAuth atual ou voltamos para Basic Auth tradicional.

### Passo D — Testar com outro cartão
Tentativa de R$ 1,00 com cartão de outra bandeira, para descartar recusa do emissor.

## Detalhes técnicos relevantes

- Hoje o código em `supabase/functions/rede-cobrar-cartao/index.ts` faz:
  ```
  Authorization: Bearer <access_token OAuth>
  POST https://api.userede.com.br/erede/v1/transactions
  ```
- OAuth está sendo emitido em `https://api.userede.com.br/redelabs/oauth2/token` — endpoint do produto Rede Labs.
- A mistura “token Rede Labs + endpoint e-Rede clássico” é a anomalia mais suspeita agora que o cadastro foi confirmado.

## Entregáveis depois da sua aprovação

1. Endpoint de diagnóstico GET no `rede-cobrar-cartao` que execute Passo A (Basic Auth) e devolva HTTP status + body cru da Rede, sem afetar a cobrança real.
2. Flag temporária para testar `capture: false` (Passo B).
3. Relatório dos dois testes para decidir se trocamos definitivamente o fluxo de autenticação para Basic Auth.

Quer que eu siga por esse caminho (Passos A e B implementados como diagnóstico)?