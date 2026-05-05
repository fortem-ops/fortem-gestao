## Mudanças

### 1. Novo: `src/components/tasks/RescheduleDialog.tsx`
Extrair o dialog de reagendamento (com motivo obrigatório) do `TaskCenter` para reuso.

### 2. `src/pages/TaskCenter.tsx`
- Importar `RescheduleDialog` do novo arquivo (remover definição local).
- Renomear aba "Pendentes" para **"Programadas"** (mantém filtro pendente && !atrasada, ordenadas cronologicamente).
- Adicionar badge visual "Automática" na lista de tarefas quando `automatica = true`.

### 3. `src/components/student/StudentTasks.tsx` (reescrita)
Substituir placeholder por listagem real:
- Query `tarefas` com `aluno_id = student.id`, ordenado por `data_limite ASC`.
- Carregar nomes dos responsáveis via `profiles`.
- Três seções em ordem cronológica:
  - **Atrasadas** (vermelho)
  - **Programadas** (pendentes futuras + hoje, inclui tarefa de 30 dias)
  - **Concluídas**
- Cada item: ícone status (toggle concluir/reabrir), título, descrição, responsável, data, badge prioridade, badge "Automática".
- Botão **Reagendar** (usa `RescheduleDialog`).
- Botão **Nova Tarefa** já com `aluno_id` pré-preenchido e `responsavel_id` = `aluno.responsavel_id` por padrão.
- Invalidar `["tarefas-aluno", student.id]`, `["tarefas-all"]`, `["dashboard-tarefas"]` após mutações.

## Resultado
Tarefa automática "Atualizar treino — {aluno}" (D+30) criada ao finalizar prescrição passa a aparecer:
- Central de Tarefas → aba "Programadas" com badge "Automática".
- Perfil do Aluno → Tarefas → seção "Programadas".
Em ambos os locais o professor pode dar baixa ou reagendar com motivo obrigatório.
