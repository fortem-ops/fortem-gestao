# Tarefas: pipeline só para administradores e fim das concluídas

## O que muda

### 1. Tarefas comerciais passam a ser do administrador
Todas as tarefas que nascem do funil comercial (origem "pipeline") deixam de cair para professores e coordenadores e passam a ter um administrador como responsável. Isso inclui:

- Realizar primeiro contato (novo lead)
- Confirmar presença na avaliação
- Follow-up da proposta
- Tarefas criadas manualmente na tela do pipeline, como "Confirmar o pagamento do plano", "Fazer follow-up das informações encaminhadas", "Encerrar o atendimento"

Regra usada: qualquer tarefa com origem "pipeline". Assim, tarefas comerciais futuras já entram na regra sem novo ajuste.

Responsável escolhido: o administrador mais antigo do sistema (hoje há 2 administradores cadastrados). Se preferir um nome fixo específico, é só dizer.

Além disso, professores e coordenadores deixam de ver essas tarefas na Central de Tarefas, no painel do Dashboard e na aba Tarefas da ficha do aluno — mesmo usando o filtro "Todos os profissionais". Só administradores enxergam.

Tarefas comerciais em aberto que hoje estão com professores/coordenadores (cerca de 200 registros) são transferidas para o administrador.

### 2. Fim das tarefas concluídas
- A aba "Concluídas" sai da Central de Tarefas.
- Ao marcar uma tarefa como concluída, o registro é apagado e some da lista na hora.
- As tarefas já concluídas hoje são apagadas.
- As tarefas que o sistema conclui sozinho (ex.: ao registrar uma avaliação) também passam a ser apagadas em vez de ficarem marcadas como concluídas.
- A aba "Todas" passa a mostrar só o que está em aberto.

## Detalhes técnicos

- Migration: `fn_move_pipeline` passa a resolver o responsável das tarefas de pipeline por uma função nova `fn_admin_tarefas_pipeline()` (admin mais antigo em `user_roles`), em vez do responsável do aluno.
- `ScheduleTaskDialog.tsx`: ao criar/editar tarefa de pipeline, grava `responsavel_id` do administrador retornado pela mesma função (via RPC).
- Migration: gatilhos/funções que hoje fazem `UPDATE tarefas SET status='concluida'` (`fn_concluir_tarefas_por_avaliacao`, geradores de relatório técnico e afins) passam a `DELETE FROM tarefas`.
- `TaskCenter.tsx`: remove aba "Concluídas" e o array `done`; a consulta passa a filtrar `status <> 'concluida'`; para usuário sem papel admin adiciona `neq("origem", "pipeline")`; `handleToggle` passa a excluir a tarefa em vez de atualizar status; invalida também `tarefas-badge`.
- `TasksWidget.tsx`, `AlertsWidget.tsx`, `StudentTasks.tsx` e `useTarefasBadge.ts`: mesmo filtro de origem para não administradores.
- Painéis do pipeline (`PipelineTasksPanel`, `PipelineLeadSummary`, `PipelineLeadDrawer`, `PipelineActivityTimeline`) continuam funcionando, apenas deixam de contar com tarefas concluídas persistidas; a conclusão ali também vira exclusão.
- Limpeza de dados (via consultas, não migration): apagar tarefas com `status='concluida'` e reatribuir tarefas abertas com `origem='pipeline'` ao administrador.

## Verificação
- Typecheck e build.
- Suíte de testes completa.
- Conferência no banco: nenhuma tarefa concluída restante e nenhuma tarefa de pipeline aberta com responsável não administrador.
