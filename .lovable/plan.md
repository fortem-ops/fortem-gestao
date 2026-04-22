
## Objetivo
Adicionar o módulo **Pipeline Comercial (CRM Fortem)** como camada estratégica sobre o cadastro de alunos existente. MVP enxuto: Kanban arrastável, automações com Avaliações/Planos/Tarefas/Agenda, detecção automática de risco de evasão. Sem WhatsApp API, sem relatórios avançados (ficam para depois).

## Banco de dados (migrations)

### Novas tabelas
- **`pipeline_stages`** — etapas do funil. Campos: `id`, `name`, `position`, `color`, `is_active`, `created_at`. Seed com as 13 etapas Fortem.
- **`pipeline_movements`** — histórico imutável de movimentações. Campos: `id`, `aluno_id`, `from_stage_id`, `to_stage_id`, `moved_by_user_id`, `moved_at`, `time_in_previous_stage` (interval), `notes`, `source` (enum: manual/auto_avaliacao/auto_plano/auto_evasao/auto_recuperacao), `created_at`.
- **`pipeline_metadata`** — 1:1 com aluno, dados comerciais. Campos: `aluno_id` (PK/FK), `temperatura_lead` (frio/morno/quente), `probabilidade_fechamento` (int 0-100), `origem_lead` (text), `valor_estimado_plano` (numeric), `data_prevista_fechamento` (date), `responsavel_comercial_id` (uuid), `last_contact_at`, `next_followup_at`, `created_at`, `updated_at`.

### Alterações em `alunos` (sem duplicar)
- Adicionar `current_pipeline_stage_id uuid` (FK → `pipeline_stages.id`, nullable).
- Estender enum lógico de `status` para aceitar leads (não-quebrante; valor default segue 'ativo').

### RLS
- `pipeline_stages`: SELECT autenticado; INSERT/UPDATE/DELETE só admin.
- `pipeline_movements`: SELECT autenticado; INSERT autenticado (com `moved_by_user_id = auth.uid()`); sem UPDATE/DELETE (histórico imutável).
- `pipeline_metadata`: SELECT autenticado; INSERT/UPDATE coord/admin ou `responsavel_comercial_id = auth.uid()`; DELETE admin.

### Funções/triggers
- **`fn_move_pipeline(aluno_id, to_stage_id, source, notes)`** — security definer. Lê stage atual, calcula `time_in_previous_stage`, insere em `pipeline_movements`, atualiza `alunos.current_pipeline_stage_id`, dispara criação de tarefas automáticas (ver abaixo).
- **Trigger em `avaliacoes` (AFTER INSERT)** → se aluno está em "Avaliação confirmada/agendada", chama `fn_move_pipeline` para "Avaliação realizada".
- **Trigger em `planos` (AFTER INSERT WHERE ativo=true)** → move para "Plano contratado" e em seguida "Aluno ativo"; também garante `responsavel_id` ↔ professor.
- **Trigger em `agenda_servicos` (AFTER INSERT)** → se atividade é "Avaliação Funcional/Física" e aluno em "Novo lead/Contato realizado", move para "Avaliação agendada"; se "Treino Experimental", move para "Aula experimental agendada".
- **`fn_detect_evasao()`** — função SQL chamada manualmente (botão admin) e por cron diário: marca alunos ativos sem evento de agenda nos últimos 7 dias OU plano expirando em <15 dias como "Risco evasão"; se voltam a ter evento → "Aluno recuperado".
- **Cron diário (pg_cron)** chamando `fn_detect_evasao` às 03:00.

### Tarefas automáticas (regras dentro de `fn_move_pipeline`)
| Etapa destino | Tarefa criada (em `tarefas`) |
|---|---|
| Novo lead | "Realizar primeiro contato" (prazo +1d) |
| Avaliação agendada | "Confirmar presença" (prazo: dia anterior) |
| Proposta enviada | "Follow-up da proposta" (prazo +3d) |
| Risco de evasão | "Contato de retenção" (prazo +1d) |

`responsavel_id` da tarefa = `responsavel_comercial_id` do metadata, fallback `responsavel_id` do aluno.

## Frontend

### Nova rota
- `/pipeline` → `src/pages/Pipeline.tsx`. Adicionar item no `AppSidebar.tsx` com ícone `KanbanSquare`.

### Componentes novos (`src/components/pipeline/`)
- **`PipelineKanban.tsx`** — board principal. Usa `@dnd-kit/core` (já instalável) para drag-drop entre colunas. Cada coluna = stage; card = aluno.
- **`PipelineCard.tsx`** — mostra nome, foto, temperatura (badge colorido), valor estimado, dias na etapa, professor responsável. Click → navega para `/alunos/:id`.
- **`PipelineFilters.tsx`** — filtros: professor, etapa (foco), origem, período (movimentações), busca por nome.
- **`PipelineMetadataDialog.tsx`** — edita campos comerciais (temperatura, probabilidade, origem, valor, data prevista, responsável comercial, próximo follow-up).
- **`PipelineHistoryTimeline.tsx`** — lista cronológica de movimentações de um aluno (usado em StudentProfile).

### Cores das etapas (Tailwind tokens, segue padrão do projeto)
- Lead novo / Contato → `bg-blue-500/20 border-blue-500/30`
- Avaliações → `bg-amber-500/20`
- Aula experimental / Proposta → `bg-orange-500/20`
- Plano contratado / Aluno ativo → `bg-emerald-500/20`
- Risco evasão → `bg-rose-500/20`
- Aluno perdido → `bg-zinc-600/30`

### Integração com telas existentes
- **`StudentProfile.tsx`** — nova aba "Pipeline" contendo: stage atual (badge clicável que abre dropdown para mover), `PipelineMetadataDialog`, `PipelineHistoryTimeline`. Botões wa.me com mensagens pré-preenchidas (Boas-vindas, Confirmar avaliação, Lembrete, Convite experimental, Proposta, Recuperar) — mensagens em template literal usando nome do aluno.
- **`AddStudentDialog.tsx`** — ao criar aluno, opcionalmente já marcar como "Novo lead" (default) e capturar `origem_lead`.
- **`Dashboard.tsx`** — adicionar widget `PipelineWidget` mostrando: leads novos no período, contagem por etapa (mini-funil visual), alunos em risco. Reaproveita layout dos widgets existentes.

### Permissões UI
- Drag-drop habilitado para coordenador/admin (qualquer aluno) e professor (apenas seus alunos via `responsavel_id`).
- `PipelineMetadataDialog`: edição liberada para coordenador/admin e responsável comercial.

## Fora de escopo (nesta entrega)
- Tabela `pipeline_stage_timers` (o `time_in_previous_stage` no histórico já cobre o MVP).
- Tabela `crm_messages` e WhatsApp Cloud API — apenas links wa.me.
- Aba "Relatórios CRM" completa.
- Novo papel "Consultor comercial".

## Arquivos tocados
- Migrations SQL (novas tabelas, alterações em `alunos`, triggers, funções, cron, RLS, seed de stages).
- `src/pages/Pipeline.tsx` (novo).
- `src/components/pipeline/*` (novos, 5 arquivos).
- `src/components/AppSidebar.tsx` (adicionar item).
- `src/pages/StudentProfile.tsx` (nova aba Pipeline).
- `src/components/student/AddStudentDialog.tsx` (campo origem_lead).
- `src/pages/Dashboard.tsx` + `src/components/dashboard/PipelineWidget.tsx` (novo widget).
- `package.json` (`@dnd-kit/core`, `@dnd-kit/sortable`).
