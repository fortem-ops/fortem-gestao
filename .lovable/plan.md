## Objetivo
Adicionar logs temporários para diagnosticar por que `/pix/v2/rec` retorna 401, expondo CLIENT_ID, token gerado, header `x-conta-corrente` e payload enviado.

## Mudanças

### 1) `supabase/functions/inter-auth/index.ts`
Antes da resposta, logar (mascarado) o CLIENT_ID e o token obtido:
```ts
const clientId = Deno.env.get("INTER_CLIENT_ID") ?? "";
console.log("[inter-auth] CLIENT_ID:", clientId.substring(0, 8) + "..." + clientId.slice(-4), "len=", clientId.length);
console.log("[inter-auth] token prefix:", token.substring(0, 20), "len=", token.length);
```

### 2) `supabase/functions/_shared/inter.ts`
- Em `fetchNewToken`, logar o CLIENT_ID em uso e prefixo do token retornado pelo OAuth (para confirmar qual app está autenticando).
- Em `interFetch`, antes do `fetch`, logar:
  - URL completa chamada
  - Prefixo do token usado
  - Header `x-conta-corrente`
  - Payload completo (quando `init.json` definido), via `JSON.stringify(init.json)`
- Após resposta, logar `status` e `raw` truncado quando `status >= 400`.

### 3) `supabase/functions/pix-criar-recorrencia/index.ts`
Antes de chamar `interFetch`, logar o payload completo já montado:
```ts
console.log("[pix-criar-recorrencia] payload:", JSON.stringify(payload));
```

## Após o deploy
Pedir ao usuário para tentar criar a recorrência novamente e, em seguida, buscarei os logs via `supabase--edge_function_logs` para `pix-criar-recorrencia` e `inter-auth` e mostrarei o conteúdo completo.

## Observação de segurança
Os logs são temporários (diagnóstico). Tokens são logados apenas por prefixo. Após identificar a causa do 401, devemos remover esses logs.
