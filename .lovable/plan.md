## Objetivo

Criar uma edge function **pública** (sem JWT) que recebe um CPF e devolve dados básicos do aluno (`nome`, `data_nascimento`, `telefone`, `email`) caso exista na tabela `alunos`. Uso típico: formulário externo de pré-cadastro / autoatendimento.

## Arquivo a criar

`supabase/functions/public-lookup-by-cpf/index.ts`

## Ajustes que vou aplicar sobre o código enviado

O código colado funciona, mas tem 3 problemas que vou corrigir antes de salvar:

1. **Escala**: hoje faz `select ... limit(50)` e filtra no JS — só acharia alunos entre os 50 primeiros. Vou trocar por filtro direto no banco usando os dígitos do CPF (a coluna `cpf` na tabela `alunos` pode estar formatada `xxx.xxx.xxx-xx` ou só dígitos, então uso `or(cpf.eq.<formatado>,cpf.eq.<digitos>)` ou `ilike` por dígitos via `regexp_replace` — confirmo o formato real antes de codar).
2. **CORS preflight**: incluir `Access-Control-Allow-Methods: POST, OPTIONS` e responder 204 no OPTIONS.
3. **Config `verify_jwt = false`**: por ser função pública, adicionar bloco específico em `supabase/config.toml` para essa função.

Mantenho:
- Validação de CPF (dígitos verificadores)
- Uso do `SUPABASE_SERVICE_ROLE_KEY` (já disponível automaticamente no runtime das edge functions)
- Resposta `{ found: false }` quando não acha, `{ found: true, data: {...} }` quando acha
- Nunca devolver o CPF na resposta

## Detalhes técnicos

- Cliente Supabase via `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` para bypassar RLS (necessário em endpoint público controlado).
- Endpoint só aceita `POST` com body `{ "cpf": "..." }`. Outros métodos → 405.
- Rate limiting: não implementado nesta versão (posso adicionar depois com tabela de tentativas se quiser).
- Em `supabase/config.toml`:
  ```toml
  [functions.public-lookup-by-cpf]
  verify_jwt = false
  ```

## Como chamar do frontend / externo

```ts
fetch("https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/public-lookup-by-cpf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cpf: "123.456.789-09" }),
})
```

Não precisa de `Authorization` nem `apikey`.

## Pergunta antes de implementar

A tabela `alunos.cpf` está armazenada **formatada** (`827.275.380-49`) ou **só dígitos** (`82727538049`)? Se você não souber, eu confiro consultando o banco no início da implementação e adapto a query.
