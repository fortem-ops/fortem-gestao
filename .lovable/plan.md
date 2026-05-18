## Objetivo

Criar uma tela em **Admin → Notificações por Email** para gerenciar de forma visual:
- **Remetente** (nome e email exibidos no FROM, atualmente fixo `FORTEM <contatofortem@gmail.com>`)
- **Destinatários** por tipo de evento (atividades monitoradas + regra de quem recebe)
- **Regras de disparo** (ativar/desativar agendado, cancelado, exigir aluno vinculado)

Acesso restrito a **admin/coordenador**.

---

## 1. Banco de dados

Nova tabela `notificacao_email_config` (single-row, padrão `id = 1`):

| Coluna | Tipo | Default |
|---|---|---|
| `id` | int | 1 (check =1) |
| `remetente_nome` | text | 'FORTEM' |
| `remetente_email` | text | 'contatofortem@gmail.com' |
| `atividades_monitoradas` | text[] | `{Treino Experimental, Avaliação Funcional}` |
| `enviar_em_agendamento` | bool | true |
| `enviar_em_cancelamento` | bool | true |
| `exigir_aluno_vinculado` | bool | true |
| `destinatarios_regra` | text | 'profissional_vinculado' (enum: profissional_vinculado, profissional_e_coordenadores, profissional_coord_admin, todos_staff) |
| `emails_extras` | text[] | `{}` (cópia fixa em todo disparo) |
| `updated_at`, `updated_by` | — | — |

RLS:
- SELECT: qualquer authenticated
- UPDATE: apenas `is_coordinator_or_admin(auth.uid())`
- Sem INSERT/DELETE (row seed via migration)

Seed da linha única com defaults atuais.

## 2. Edge function `notify-agenda-evento`

Ajustar para:
1. Ler `notificacao_email_config` no início; se `id=1` não existe, usar defaults atuais.
2. Validar evento (`agendado`/`cancelado`) contra flags `enviar_em_*`.
3. Validar `atividade` contra `atividades_monitoradas` (substitui `ATIVIDADES_PERMITIDAS` hardcoded).
4. Aplicar `exigir_aluno_vinculado`.
5. Resolver destinatários conforme `destinatarios_regra` consultando `user_roles` (já existente). Sempre inclui `emails_extras` em cópia.
6. Usar `remetente_nome`/`remetente_email` no `from` (SMTP continua usando `contatofortem@gmail.com` + `GMAIL_APP_PASSWORD`; se `remetente_email` divergir, ainda enviamos via Gmail mas com header `from` configurado — observação no UI).

Trigger `fn_notificar_agenda_evento` continua igual (filtragem detalhada migra para a edge function, fonte única de verdade).

## 3. Frontend

Nova página `src/pages/AdminNotificacoesEmail.tsx` em rota `/admin/notificacoes-email` (lazy + ProtectedRoute coord/admin), com seções:

- **Remetente**: inputs nome + email (helper: "O envio usa a conta Gmail contatofortem@gmail.com; alterar o email aqui muda apenas o nome exibido no header From.")
- **Atividades monitoradas**: multi-select com chips (Treino Experimental, Avaliação Funcional, livre para adicionar outras).
- **Eventos**: dois switches (agendamento / cancelamento).
- **Regra de destinatários**: radio com as 4 opções.
- **Aluno obrigatório**: switch.
- **Emails extras (cópia)**: lista editável de emails.
- Botão **Salvar** → `update` em `notificacao_email_config` (id=1).
- Botão **Enviar email de teste** → invoca `notify-agenda-evento` com payload sintético `evento=teste`, ou função dedicada `notify-agenda-test`.

Adicionar entrada no menu do AppLayout (seção Admin) e rota em `App.tsx`.

## 4. Frontend fallback existente

Em `AddAgendaDialog.tsx` e `Agenda.tsx`, manter o invoke; a edge function agora decide tudo (atividades, evento, regras), então a checagem hardcoded de atividade pode permanecer apenas como atalho.

---

## Detalhes técnicos

```text
src/
├── pages/AdminNotificacoesEmail.tsx        (nova)
├── App.tsx                                  (+ rota)
├── components/AppLayout.tsx                 (+ item menu)

supabase/
├── migrations/...                           (nova tabela + RLS + seed)
└── functions/notify-agenda-evento/index.ts  (lê config dinâmica)
```

Sem novos secrets — continua `GMAIL_APP_PASSWORD`.
