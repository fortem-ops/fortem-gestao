# Tarefas: contador no menu, fim do Contato de Retenção e avaliações funcionais

## 1. Contador no menu lateral (Principal > Tarefas)

Ao lado de "Tarefas" passam a aparecer dois números, no mesmo estilo do "Notificar":

- vermelho: tarefas atrasadas (prazo vencido e não concluídas)
- azul: tarefas automáticas em aberto

Ambos contam apenas as tarefas em que o usuário logado é o responsável. Atualizam sozinhos a cada minuto e quando a Central de Tarefas é usada.

## 2. Pausar o Contato de Retenção

Como a frequência de alunos ainda não é usada:

- O sistema deixa de mover alunos automaticamente para "Risco de evasão" (as demais movimentações automáticas — renovação de plano e inativação — continuam funcionando normalmente).
- Deixa de criar a tarefa "Contato de retenção".
- As 507 tarefas de Contato de Retenção já existentes são excluídas (as 4 já concluídas também saem, para a lista ficar limpa; se preferir mantê-las, é só avisar).

O movimento manual no Pipeline para "Risco de evasão" continua disponível, apenas sem gerar tarefa.

## 3. Avaliações funcionais viram tarefas programadas/atrasadas

A regra passa a ser a mesma da tela Cadastros > Alunos Ativos:

- Nunca realizada: a tarefa nasce como **atrasada**.
- 6 meses ou mais desde a última: **atrasada**.
- Entre 4 e 6 meses: **programada** (prazo = última avaliação + 4 meses).
- Menos de 4 meses: nenhuma tarefa.

A tarefa "Agendar reavaliação funcional" leva ao perfil do aluno na aba de avaliações, como já acontece hoje. Passa a ser criada também quando o responsável do aluno é um administrador — hoje esses alunos ficavam sem tarefa, por isso só existem 2 na base.

A varredura diária existente continua rodando às 10h; além disso ela será executada uma vez logo após a mudança, para gerar de imediato as tarefas de todos os alunos ativos em atraso ou pendentes.

## 4. Duas novas tarefas automáticas para os professores

**Relatório do treino experimental** — assim que o horário do treino experimental passa, o professor
responsável recebe a tarefa "Realizar relatório do treino experimental", com o nome do prospect e o
botão "Realizar" abrindo direto o formulário de avaliação experimental dele. Prazo: o dia seguinte ao
treino; depois disso entra em Atrasadas. A tarefa se fecha sozinha quando o relatório é preenchido.

**Avaliação funcional agendada** — ao agendar uma avaliação funcional, a tarefa "Realizar avaliação
funcional" nasce **programada** com prazo no dia do agendamento e, se o dia passar sem a avaliação
registrada, aparece em **Atrasadas**. Também se fecha sozinha quando a avaliação é lançada.

Se o agendamento for cancelado, a tarefa correspondente é removida.

## Detalhes técnicos

- `src/components/AppSidebar.tsx`: novo `TarefasSidebarItem` com hook `useTarefasBadge` (dois `count: "exact", head: true` em `tarefas`, filtrando `responsavel_id = user.id`, `status <> 'concluida'`, e `data_limite < hoje` / `automatica = true`). Reaproveita o padrão visual do badge de não lidas.
- Migration:
  - `fn_move_pipeline`: remove o `INSERT` da tarefa `pipeline_risco_evasao`.
  - `fn_detect_evasao`: remove o bloco "Ativo → Risco de evasão"; mantém Renovação e Inativo.
  - `fn_resolver_responsavel_reavaliacao`: deixa de descartar responsáveis com papel admin.
  - `fn_criar_tarefa_reavaliacao`: `data_limite = CURRENT_DATE - 1` quando não há avaliação anterior; caso contrário `_data_ultima + 4 meses`. Prioridade `alta` quando atrasada, `media` quando programada.
  - Novos `tipo_auto`: `relatorio_experimental` e `avaliacao_funcional_agendada`.
  - Trigger em `agenda_servicos` (INSERT): quando `atividade ILIKE '%funcional%'` e `aluno_id` não nulo, cria tarefa `avaliacao_funcional_agendada` (responsável = `profissional_id`, `data_limite = data_especifica`, idempotente por aluno+agenda). Trigger de DELETE remove a tarefa aberta vinculada.
  - Função diária `fn_gerar_tarefas_pos_experimental()` + cron às 10h junto da varredura existente: para cada `agenda_servicos` experimental já ocorrida (`data_especifica < CURRENT_DATE`, ou hoje com `horario_fim < now()`) sem relatório experimental registrado, cria tarefa `relatorio_experimental` com `data_limite = data_especifica + 1`.
  - Trigger em `avaliacoes` (INSERT): conclui automaticamente as tarefas abertas de `avaliacao_funcional_agendada` (tipo funcional) e `relatorio_experimental` (tipo experimental) do aluno.
- `src/lib/taskAction.ts`: `avaliacao_funcional_agendada` → `/alunos/{id}?tab=avaliacoes`; `relatorio_experimental` → `/alunos/{id}?tab=avaliacoes` (abrindo o formulário experimental do prospect).
- Dados (fora de migration): `DELETE FROM tarefas WHERE tipo_auto = 'pipeline_risco_evasao'`, `SELECT fn_agendar_reavaliacoes_pendentes();` e uma execução inicial de `fn_gerar_tarefas_pos_experimental()`.
- Invalidação das queries do badge junto com `tarefas-all` na Central de Tarefas.

