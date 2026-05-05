## Objetivo

Ao finalizar a prescrição de um treino (aplicar ao aluno), criar automaticamente uma tarefa "Atualizar treino" para o professor responsável, com vencimento em 30 dias. Essa tarefa aparece em **Alertas Técnicos** (dashboard) e na **Central de Tarefas**. No dia (ou depois), o professor pode:
- **Concluir** a tarefa (baixa), ou
- **Reagendar** para nova data, sendo **obrigatório** descrever o motivo.

A lista de Tarefas passa a ser ordenada **cronologicamente** pela data limite (mais próxima primeiro).

---

## Mudanças

### 1. Criação automática da tarefa ao salvar treino
Em `src/components/student/workout/PersonalizadoEditor.tsx` (função `saveToAluno`), após o `insert`/`update` em `treinos` com sucesso e quando o status fica `atual`, inserir em `tarefas`:
- `titulo`: "Atualizar treino — {nome do aluno}"
- `descricao`: "Revisar e atualizar a prescrição de treino do aluno."
- `aluno_id`: alvo
- `responsavel_id`: `aluno.responsavel_id` (fallback: `user.id`)
- `criado_por_id`: `user.id`
- `data_limite`: hoje + 30 dias
- `prioridade`: "media"
- `automatica`: true
- `tipo_auto`: `"atualizar_treino"`

Antes de criar, marcar como `concluida` qualquer tarefa anterior pendente do mesmo aluno com `tipo_auto = 'atualizar_treino'` (evita duplicar quando o professor já está atualizando).

### 2. Alerta Técnico no dashboard
Em `src/components/dashboard/AlertsWidget.tsx`, adicionar fonte de alertas a partir de `tarefas` onde `tipo_auto = 'atualizar_treino'` e `status != 'concluida'`:
- Filtra pelo `responsavel_id = professorId`
- Severidade: `urgente` se `data_limite <= hoje`, `atencao` se faltam ≤ 7 dias, caso contrário não exibe
- Mensagem: "Atualizar treino em X dias" / "Atualização de treino atrasada (X dias)"
- Click navega para `/tarefas`

### 3. Reagendar tarefa com motivo obrigatório
Em `src/pages/TaskCenter.tsx`:
- Adicionar botão **"Reagendar"** ao lado do badge de prioridade em cada tarefa pendente.
- Abrir um `Dialog` com:
  - Campo data (nova `data_limite`, obrigatório, ≥ hoje)
  - Campo `Textarea` "Motivo" (obrigatório, mínimo 5 caracteres)
- Ao confirmar, fazer `update` em `tarefas`:
  - `data_limite` = nova data
  - `descricao` = descrição original + bloco "\n\n[Reagendado em DD/MM/AAAA]: {motivo}"
- Toast de sucesso e invalidar queries (`tarefas-all`, `dashboard-tarefas`, `dashboard-alerts`).
- Botão de **concluir** (check) já existe — mantém para "dar baixa".

### 4. Ordenação cronológica em Tarefas
Já há `order("data_limite", { ascending: true, nullsFirst: false })` em `TaskCenter`. Reforçar:
- Em cada `TabsContent`, garantir que a `TaskList` recebe lista ordenada por `data_limite asc` (tarefas sem data ao final).
- Aplicar a mesma ordenação no `TasksWidget` do dashboard (já está ascending).

---

## Detalhes técnicos

- Sem alterações de schema; `tarefas.tipo_auto` já é `text` e suporta o novo valor `"atualizar_treino"`.
- RLS: `tarefas` permite `INSERT` quando `criado_por_id = auth.uid()` e `UPDATE` para `responsavel_id` ou coord/admin — compatível.
- Histórico do reagendamento fica embutido em `descricao` (sem nova tabela).
- Sem mudanças no portal do aluno.

## Arquivos a editar
- `src/components/student/workout/PersonalizadoEditor.tsx` — criar tarefa após salvar
- `src/components/dashboard/AlertsWidget.tsx` — adicionar alerta de atualização de treino
- `src/pages/TaskCenter.tsx` — botão/dialog de reagendar com motivo + ordenação
