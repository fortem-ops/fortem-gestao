
## 1. Anamnese inicial visível no agendamento e enviada no email

**`src/components/agenda/AddAgendaDialog.tsx`**
- Buscar `alunos.responsavel_id` na query `alunos_agenda_picker` (já lista prospects/ativos).
- Nova query `prospect_anamnese` habilitada quando há `alunoId` selecionado e a atividade for "Treino Experimental" (também exibir para "Avaliação Funcional"). Lê `limitacoes`, `atividade_fisica`, `objetivo_treinamento`.
- Renderizar um bloco "Anamnese inicial" (read-only) abaixo do seletor de aluno, com os 3 questionamentos e respostas; mostra "—" quando vazio, ou um aviso "Anamnese não preenchida" quando a linha não existe.

**`supabase/functions/notify-agenda-evento/index.ts`**
- Quando `agenda.aluno_id` existe e `evento === "agendado"`, buscar `prospect_anamnese` do aluno.
- Estender `buildHtml()` para receber `anamnese?: { limitacoes; atividade_fisica; objetivo_treinamento }` e renderizar uma seção "Anamnese inicial" no email com as 3 perguntas/respostas (somente se houver dados). Aplicado tanto a Treino Experimental quanto Avaliação Funcional (já são as atividades monitoradas).

## 2. Edição do Professor Responsável em Prospects

**`src/components/leads/EditLeadDialog.tsx`**
- Carregar também `responsavel_id` no `select` de `alunos`.
- Adicionar lista de profissionais (mesma query usada em `ConvertToProspectDialog`: roles professor/coordenador/admin + profiles).
- Novo campo `Select` "Professor responsável (opcional)" com opção "— Nenhum —".
- `save()` inclui `responsavel_id` (ou `null`) no `update` de `alunos`. Invalidar `prospects-list` e `leads-list` (já feito).
- Como o diálogo é compartilhado, o campo aparece também na edição de leads — comportamento aceitável (já existe na conversão).

## 3. Auto-preencher profissional ao selecionar prospect no Treino Experimental

**`src/components/agenda/AddAgendaDialog.tsx`**
- `useEffect` que dispara quando `alunoId` muda E `atividade === "Treino Experimental"` E `!isEditing`: se o aluno selecionado tem `responsavel_id` e o usuário ainda não escolheu manualmente um profissional diferente, setar `setProfissionalId(aluno.responsavel_id)`.
- Não sobrescrever se o usuário já alterou manualmente após a auto-seleção (rastreado por um flag simples ou comparando contra o último auto-set).

## Notas técnicas

- Sem mudanças de schema; `prospect_anamnese` e `alunos.responsavel_id` já existem com RLS adequada.
- A consulta de anamnese no edge function usa `service_role`, sem problemas de RLS.
- Notificação por email continua disparada via fluxo existente (`notify-agenda-evento`); nada muda no gatilho.
