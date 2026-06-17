## Objetivo

Quando a atividade agendada for **Treino Experimental**, exibir um campo **Consultor** (logo abaixo do Profissional) com a lista de usuários de papel `admin` (Nicolas, Bruno, etc.). O consultor escolhido deve receber as mesmas notificações já configuradas para o profissional vinculado:
- Email no agendamento
- Email no cancelamento
- Email + sino 30 minutos antes do evento

## Mudanças

### 1. Banco — adicionar coluna `consultor_id` (migração)
```sql
ALTER TABLE public.agenda_servicos
  ADD COLUMN consultor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_agenda_consultor ON public.agenda_servicos(consultor_id);
```
Sem mudanças em RLS/GRANTs (a tabela já é coberta).

### 2. Frontend — `src/components/agenda/AddAgendaDialog.tsx`
- Adicionar estado `consultorId` e carregamento das edições/prefill.
- Carregar lista de admins via `user_roles.role = 'admin'` + `profiles.full_name`.
- Renderizar o `<Select>` **Consultor** logo após o de Profissional, **somente quando** `atividade === "Treino Experimental"`.
- Incluir `consultor_id: consultorId || null` no payload de insert/update.
- Limpar no `resetForm`.

### 3. Edge function `notify-agenda-evento` (agendado/cancelado)
- Incluir `consultor_id` no `select` da agenda.
- Se houver `consultor_id`, buscar o email do consultor via `auth.admin.getUserById` e adicioná-lo ao `cc` (mesma deduplicação que já existe).
- Adicionar uma linha "Consultor" no `buildHtml`, exibida apenas para Treino Experimental quando preenchida.

### 4. Edge function `notify-agenda-proximos` (30 min antes)
- Incluir `consultor_id` no `select`.
- Para cada item pendente: se houver consultor, criar destinatário interno adicional em `notificacao_destinatarios` (mesma notificação) e enviar o mesmo email para o consultor (com chave de idempotência já existente `proximo_30min_<data>` por agenda — então não duplica para a mesma agenda; o consultor recebe junto, no mesmo ciclo).

## Fora de escopo
- Não alterar a regra `destinatarios_regra` da tela de configurações de email — o consultor é uma adição específica e independente da regra global.
- Não alterar comportamento para atividades diferentes de Treino Experimental.