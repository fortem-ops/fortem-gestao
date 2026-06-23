# Corrigir endpoint transacional para Rede Labs (OAuth 2.0)

## Contexto

A autenticação OAuth 2.0 está 100% correta e o token é emitido com sucesso. O erro **370** vem do endpoint transacional, que hoje aponta para a **API e-Rede Clássica** (`/erede/v1/transactions`), que não aceita Bearer token — ela espera `Basic PV:IntegrationKey`. Como a Rede confirmou que seu PV está habilitado para **Rede Labs (OAuth 2.0)**, precisamos trocar a URL transacional para o endpoint Labs equivalente, que é o que casa com o Bearer token.

## O que fazer

### 1. Trocar as URLs base (`supabase/functions/rede-cobrar-cartao/index.ts`, linhas 6-9)

De:
```ts
const REDE_URLS = {
  sandbox:  "https://sandbox-erede.useredecloud.com.br/v1",
  producao: "https://api.userede.com.br/erede/v1",
};
```

Para os endpoints **Rede Labs**:
```ts
const REDE_URLS = {
  sandbox:  "https://rl7sandbox-api.useredecloud.com.br/redelabs/merchant/v1",
  producao: "https://api.userede.com.br/redelabs/merchant/v1",
};
```

(Mesmas raízes do `/oauth2/token` que já funciona — só muda o path para `/redelabs/merchant/v1/transactions`.)

### 2. Forçar `auth_mode = "bearer"` no fluxo POST

Como confirmamos que o produto é Labs, o ramo "basic" do diagnóstico passa a ser somente para troubleshooting. Manter o default `Bearer` e deixar `auth_mode: "basic"` apenas como override de diagnóstico — sem mudança estrutural, só garantir que o caminho padrão é OAuth.

### 3. Rodar de novo o GET de diagnóstico

Após deploy, chamar o endpoint de diagnóstico (com `?test=transactions`) para validar que `/redelabs/merchant/v1/transactions` responde estruturadamente (esperado: 4xx com `returnCode` informativo no GET de ping, e não mais 370/500).

### 4. Tentar a cobrança real

Fazer uma cobrança de teste pelo dialog. Resultados esperados:
- **Sucesso:** `returnCode "00"` → fluxo OK, salva em `pagamentos_rede`.
- **Falha estruturada (ex.: cartão recusado pelo emissor):** `returnCode` específico (05, 51, etc.) → problema do cartão, não da integração.
- **Se ainda vier 370:** significa que o PV foi habilitado para Labs mas a conta/produto específico não cobre a operação solicitada — aí volta para a Rede com essa evidência específica.

## Detalhes técnicos

- Endpoints Rede Labs seguem o padrão `https://<host>/redelabs/merchant/v1/<recurso>`. O host de produção (`api.userede.com.br`) e o de sandbox (`rl7sandbox-api.useredecloud.com.br`) são os mesmos do OAuth, então o token Bearer emitido é aceito sem conversão.
- Não há alteração de payload, headers extras ou contrato de resposta — o JSON de `transactions` da Labs é compatível com o que já montamos (`amount`, `installments`, `cardNumber`, `expirationMonth`, `expirationYear`, `securityCode`, `cardholderName`, `reference`, `capture`, `kind`).
- Nenhuma migration. Nenhum secret novo. Apenas edição da constante `REDE_URLS` e redeploy da função.

## Risco / fallback

Se após a troca o endpoint Labs responder `404` ou `401`, isso significa que o path correto na sua conta é levemente diferente (algumas contas Labs usam `/redelabs/v1/transactions` sem `/merchant`). Nesse caso testo as duas variantes no GET de diagnóstico antes de mexer no POST.
