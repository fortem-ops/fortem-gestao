## Objetivo

Disparar e-mails automáticos via Gmail SMTP (mesma infra do `notify-agenda-evento`) para três eventos:

1. **Tarefas** — quando uma tarefa é criada (manual ou automática) → e-mail ao responsável.
2. **Notificações** (Principal → Notificar) — quando uma nova notificação é criada que aguarda resposta → e-mail aos destinatários; quando alguém responde (status muda para `respondida` ou novo comentário) → e-mail ao criador.
3. **Agendamentos do dia** — todo dia de manhã, e-mail ao profissional listando seus agendamentos daquela data.

Toda a lógica reutiliza `GMAIL_APP_PASSWORD` e o padrão visual do template de e-mail já existente.

## Novas Edge Functions

### `notify-tarefa-evento`
- Acionada por **trigger Postgres** em `tarefas` (AFTER INSERT) via `pg_net.http_post`.
- Payload: `tarefa_id`, `evento` (`criada`).
- Busca dados da tarefa, e-mail do `responsavel_id` (via `profiles` → `auth.users`), aluno vinculado e remetente da config.
- Envia 1 e-mail ao responsável com título, prioridade, data limite, aluno, criada por, marca se é automática.
- Loga em nova tabela `tarefa_notificacoes_log` (idempotência por `tarefa_id+evento`).

### `notify-notificacao-evento`
- Acionada por triggers:
  - `notificacoes` AFTER INSERT → evento `nova` → e-mail a todos os destinatários (consulta `notificacao_destinatarios`).
  - `notificacao_comentarios` AFTER INSERT → evento `resposta` → e-mail ao criador da notificação (`notificacoes.criado_por`) e demais destinatários, exceto quem comentou.
  - `notificacoes` AFTER UPDATE quando `status` muda para `respondida` → evento `respondida` → e-mail ao criador.
- Inclui na mensagem: título, descrição, prioridade, categoria, prazo, link para a página `/notificar`.
- Loga em `notificacao_email_log` para idempotência por `notificacao_id+evento+usuario_id`.

### `notify-agenda-diaria` (cron)
- Roda às **07:00 BRT diariamente** via `pg_cron` + `pg_net.http_post`.
- Para cada profissional com agendamentos hoje (em `agenda_servicos`), envia 1 e-mail consolidado listando: horário, atividade, aluno, local, observações.
- Loga em `agenda_diaria_log` (chave: `profissional_id+data`) para evitar duplicidade.

## Banco de dados (migração única)

- **Tabelas de log** (estrutura: `id`, `*_id`, `evento`, `enviado_em`, índice único para idempotência):
  - `tarefa_notificacoes_log`
  - `notificacao_email_log`
  - `agenda_diaria_log`
- **RLS**: somente coord/admin podem ler (igual ao `agenda_notificacoes_log`).
- **Triggers**:
  - `trg_tarefa_after_insert` em `tarefas`.
  - `trg_notificacao_after_insert` em `notificacoes`.
  - `trg_notificacao_status_update` em `notificacoes` (quando status vai para `respondida`).
  - `trg_notificacao_comentario_insert` em `notificacao_comentarios`.
  - Cada trigger usa `pg_net.http_post` para chamar a edge function correspondente, passando o anon key (mesmo padrão do `notify-agenda-evento`).
- **Cron job** `agenda-diaria-email` agendado para `0 10 * * *` UTC (07:00 BRT).

## Painel admin (Administração → Notificações por E-mail)

Acrescentar à `notificacao_email_config` (e à UI `AdminNotificacoesEmail.tsx`) toggles independentes:

- `enviar_tarefa_criada` (default ON)
- `enviar_tarefa_automatica` (default ON)
- `enviar_notificacao_nova` (default ON)
- `enviar_notificacao_resposta` (default ON)
- `enviar_agenda_diaria` (default ON)
- `agenda_diaria_horario` (campo livre, default `07:00`)

As edge functions consultam estes flags antes de enviar.

## Detalhes técnicos

```text
Trigger (Postgres) → pg_net.http_post → Edge Function → SMTP Gmail
                                                     → INSERT em *_log
```

- Edge functions seguem o mesmo padrão de `notify-agenda-evento`: CORS, `SUPABASE_SERVICE_ROLE_KEY`, `denomailer`.
- Resolução de e-mail do usuário: `auth.users.email` via `admin.auth.admin.getUserById(uid)`.
- Idempotência: cada função tenta `INSERT` no log antes de enviar; se conflitar (unique), aborta.
- Templates HTML reutilizam o cabeçalho/footer FORTEM já existente.

## Entregas

1. Migração SQL: tabelas de log, colunas novas em `notificacao_email_config`, triggers, cron job.
2. 3 edge functions novas em `supabase/functions/`.
3. UI: novos toggles em `AdminNotificacoesEmail.tsx`.
4. Sem alterações de schema em `tarefas` / `notificacoes` além das triggers.
