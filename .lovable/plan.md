# Agendamento de tarefas no Pipeline

Replicar o comportamento do Pipedrive nos cards do Pipeline: cada card exibe uma **barra lateral colorida** indicando o status da próxima tarefa do aluno, e permite agendar/reagendar rapidamente.

## Código de cores (próxima tarefa pendente do aluno)

| Cor | Significado |
|-----|-------------|
| 🟢 Verde | Tarefa pendente para **hoje** |
| 🔴 Vermelho | Tarefa pendente **atrasada** (data_limite < hoje) |
| ⚪ Cinza | Tarefa pendente **agendada** para o futuro |
| 🟡 Amarelo | **Sem tarefa** pendente |

A regra usa a tarefa pendente mais próxima (menor `data_limite` entre as `status='pendente'` do aluno). Tarefas sem `data_limite` contam como "sem tarefa" para o indicador.

## Mudanças

### 1. Buscar próxima tarefa por aluno (`PipelineKanban.tsx`)
Nova query React Query que retorna `Record<aluno_id, { data_limite, titulo, id }>` agregando todas as tarefas `status='pendente'` com `aluno_id IN (...)`. Repassa para cada `PipelineCard` via prop `nextTask`.

### 2. Indicador no card (`PipelineCard.tsx`)
- Adicionar **barra vertical de 3px** no lado esquerdo do card com a cor calculada (helper `taskIndicatorColor(nextTask)` em `src/lib/pipeline.ts`).
- Adicionar **mini badge** (ícone Calendar/Clock + data formatada `dd/MM` ou "Hoje" / "Atrasada N d") na linha de metadados, com tooltip mostrando o título da tarefa.
- Botão de ação rápida (ícone calendário) no canto, abre o diálogo de agendamento.

### 3. Diálogo de agendamento (`ScheduleTaskDialog.tsx` — novo)
Componente em `src/components/pipeline/ScheduleTaskDialog.tsx`:
- Campos: **título** (com sugestões rápidas: "Ligar", "WhatsApp", "Confirmar avaliação", "Encerrar atendimento", "Follow-up"), **data_limite** (date picker), **prioridade**, **descrição** opcional.
- Responsável padrão = `aluno.responsavel_id` ou usuário logado.
- Se já existir tarefa pendente, oferece **Reagendar** (atualiza `data_limite`) ou **Criar nova**.
- Botão "Concluir tarefa" quando há tarefa para hoje/atrasada.
- Invalida queries: `pipeline-next-tasks`, `tarefas`.

### 4. Helper (`src/lib/pipeline.ts`)
```ts
export type TaskIndicator = "today" | "overdue" | "scheduled" | "none";
export function taskIndicator(dueDate: string | null | undefined): TaskIndicator { ... }
export const TASK_INDICATOR_CLASSES: Record<TaskIndicator, { bar: string; badge: string; label: string }> = {
  today:     { bar: "bg-emerald-500", ... , label: "Hoje" },
  overdue:   { bar: "bg-rose-500",    ... , label: "Atrasada" },
  scheduled: { bar: "bg-zinc-400",    ... , label: "Agendada" },
  none:      { bar: "bg-amber-500",   ... , label: "Sem tarefa" },
};
```

## Layout do card (atualizado)

```text
┌─┬──────────────────────────────────┐
│█│ 👤 Nome do aluno          [📅]  │   ← barra colorida à esquerda + botão agendar
│█│    @responsável                  │
│█│ [🔥 quente] [💲 70]  📅 Hoje    │   ← novo badge da próxima tarefa
└─┴──────────────────────────────────┘
```

## Fora de escopo
- Sem mudanças no schema (tabela `tarefas` já tem `aluno_id`, `data_limite`, `status`).
- Sem mudanças no backend/RLS — políticas atuais já permitem CRUD pelo responsável.
- Página `/tarefas` (TaskCenter) não é alterada.
