## Objetivo
Ajustar dois widgets do Dashboard para melhorar a usabilidade.

## 1. Alertas Técnicos — rolagem no card
**Arquivo:** `src/components/dashboard/AlertsWidget.tsx`

Atualmente o card exibe todos os alertas em uma lista sem limite de altura, fazendo com que o card fique muito grande quando há muitos alertas.

**Mudança:** envolver a lista de alertas (`<div className="space-y-3">`) em um container com altura máxima e rolagem vertical (`max-h-[320px] overflow-y-auto`).

## 2. Tarefas Pendentes — mostrar nome do aluno
**Arquivo:** `src/components/dashboard/TasksWidget.tsx`

Atualmente cada tarefa exibe o nome do responsável e a data limite, mas não mostra a qual aluno a tarefa se refere.

**Mudanças:**
- Na query de tarefas, após obter os dados, coletar os `aluno_id` únicos e fazer uma segunda consulta à tabela `alunos` para obter `nome`.
- Montar um mapa `alunoNameMap` e incluir `aluno_nome` em cada tarefa retornada.
- No JSX, exibir o nome do aluno abaixo do título da tarefa (ou substituindo/adicionando à linha que hoje mostra apenas o responsável + data).

## Fora do escopo
- Sem alterações de backend, RLS ou novas tabelas.
- Sem mudanças de layout do Dashboard (grid, ordem dos widgets).