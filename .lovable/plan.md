# Tarefas comerciais na aba Pipeline do perfil do aluno

## Objetivo

As tarefas de origem comercial (criadas pelo Pipeline ou geradas pelas automações de funil) passam a viver em **Perfil do Aluno > Pipeline**, junto com um resumo comercial e uma timeline unificada. **Registros > Tarefas** continua existindo, mas exibindo apenas as tarefas técnicas.

## Estado atual verificado

- Todas as tarefas ficam na tabela `tarefas`, com `tipo_atividade` sempre preenchido (padrão `tarefa`) e `tipo_auto` indicando automações.
- Hoje `Registros > Tarefas` (`StudentTasks.tsx`) lista **todas** as tarefas do aluno, inclusive as 630+ geradas pelas automações de pipeline (`pipeline_risco_evasao`, `pipeline_novo_lead`, `pipeline_avaliacao_agendada`) e as criadas pelo `ScheduleTaskDialog` do Pipeline.
- A aba Pipeline (`StudentPipelinePanel.tsx`) mostra só etapa atual, mensagens rápidas de WhatsApp e histórico de movimentações.
- Não existe hoje nenhuma coluna que marque a origem da tarefa.

## O que será feito

### 1. Marcar a origem da tarefa (banco)

Migração que adiciona `origem` em `tarefas` (texto, padrão `tecnico`, valores `tecnico` | `pipeline`), com índice por `(aluno_id, origem)`.

Backfill das tarefas existentes como `pipeline` quando:
- `tipo_auto` começar com `pipeline_`; ou
- `tipo_atividade` for `ligacao`, `whatsapp`, `reuniao`, `email` ou `visita` (tipos que só o diálogo do Pipeline cria).

Todo o resto fica como `tecnico`.

A partir daí, a origem passa a ser explícita: o diálogo do Pipeline grava `origem: 'pipeline'`, o diálogo de Registros grava `tecnico`, e as automações de funil gravam `pipeline`.

### 2. Aba Pipeline ganha as tarefas comerciais

Em `StudentPipelinePanel.tsx`, abaixo de "Etapa atual":

- **Resumo do lead**: origem do lead, responsável comercial, etapa atual, data de entrada na etapa, tempo na etapa e data do último contato (a partir de `pipeline_metadata`, `pipeline_movements` e `alunos`).
- **Atividades / Tarefas comerciais**: lista de pendentes, atrasadas e concluídas com concluir, reagendar e criar nova (reaproveitando o `ScheduleTaskDialog` já existente e os componentes de item de tarefa).
- **Timeline unificada**: movimentações de etapa + atividades comerciais concluídas ordenadas por data, substituindo o card atual de "Histórico de movimentações".

### 3. Registros > Tarefas fica só com o técnico

- `StudentTasks.tsx` passa a filtrar `origem = 'tecnico'`.
- O contador da subaba Tarefas em `StudentRegistros.tsx` usa o mesmo filtro.
- O diálogo "Nova Tarefa" de Registros continua criando tarefas técnicas.

## Detalhes técnicos

- Migração SQL: `ALTER TABLE public.tarefas ADD COLUMN origem text NOT NULL DEFAULT 'tecnico'` + `CHECK` nos dois valores + backfill + índice. Sem mudança de RLS ou grants (tabela já existente).
- Funções de automação do funil que inserem em `tarefas` passam a gravar `origem = 'pipeline'`.
- Frontend: novos componentes em `src/components/pipeline/` (`PipelineTasksPanel.tsx`, `PipelineLeadSummary.tsx`, `PipelineActivityTimeline.tsx`), reaproveitando `ScheduleTaskDialog` e `RescheduleDialog`.
- Invalidação de queries compartilhada entre as duas abas para os contadores não ficarem defasados.
- A aba Pipeline continua visível apenas para coordenador/admin, como já é hoje.
