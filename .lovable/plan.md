## Problema

As três Edge Functions novas (`notify-tarefa-evento`, `notify-notificacao-evento`, `notify-agenda-diaria`) chamam `client.send({ from, to, subject, html })` no `denomailer` sem passar o campo `content`. Nessa configuração o denomailer envia a mensagem sem definir corretamente o `Content-Type: text/html` multipart, e clientes como Gmail acabam exibindo o HTML como texto bruto (o usuário "vê só códigos").

A função antiga `notify-agenda-evento` apresenta o mesmo padrão e provavelmente também está com o problema — vou corrigi-la junto.

## Correção

Em cada `sendGmailEmail`, passar `content: "auto"` para que o denomailer gere automaticamente a versão texto a partir do HTML e marque o corpo como `text/html`:

```ts
await client.send({
  from: opts.from,
  to: opts.to,
  cc: opts.cc?.length ? opts.cc : undefined, // só em agenda-evento
  subject: opts.subject,
  content: "auto",
  html: opts.html,
});
```

## Arquivos a editar

1. `supabase/functions/notify-tarefa-evento/index.ts` — adicionar `content: "auto"`.
2. `supabase/functions/notify-notificacao-evento/index.ts` — idem.
3. `supabase/functions/notify-agenda-diaria/index.ts` — idem.
4. `supabase/functions/notify-agenda-evento/index.ts` — idem (preventivo, mesmo bug latente).

## Deploy & validação

- Redeploy das 4 funções via `deploy_edge_functions`.
- Validar enviando uma tarefa de teste e verificando o e-mail recebido (deve renderizar o cartão FORTEM em vez de mostrar `<html>...`).
- Conferir logs de cada função para garantir status 200 sem erros do SMTP.

Sem mudanças de banco, RLS, UI ou triggers.
