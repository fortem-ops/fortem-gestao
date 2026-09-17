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

## Detalhes técnicos

- `src/components/AppSidebar.tsx`: novo `TarefasSidebarItem` com hook `useTarefasBadge` (dois `count: "exact", head: true` em `tarefas`, filtrando `responsavel_id = user.id`, `status <> 'concluida'`, e `data_limite < hoje` / `automatica = true`). Reaproveita o padrão visual do badge de não lidas.
- Migration:
  - `fn_move_pipeline`: remove o `INSERT` da tarefa `pipeline_risco_evasao`.
  - `fn_detect_evasao`: remove o bloco "Ativo → Risco de evasão"; mantém Renovação e Inativo.
  - `fn_resolver_responsavel_reavaliacao`: deixa de descartar responsáveis com papel admin.
  - `fn_criar_tarefa_reavaliacao`: `data_limite = CURRENT_DATE - 1` quando não há avaliação anterior; caso contrário `_data_ultima + 4 meses`. Prioridade `alta` quando atrasada, `media` quando programada.
- Dados (fora de migration): `DELETE FROM tarefas WHERE tipo_auto = 'pipeline_risco_evasao'` e `SELECT fn_agendar_reavaliacoes_pendentes();`.
- Invalidação das queries do badge junto com `tarefas-all` na Central de Tarefas.
