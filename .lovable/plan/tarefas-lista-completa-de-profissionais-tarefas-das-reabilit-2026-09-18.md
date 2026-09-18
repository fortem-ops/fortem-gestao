# Tarefas: lista completa de profissionais + tarefas das reabilitações já agendadas

## 1. Filtro de profissionais na Central de Tarefas

Hoje a lista do seletor traz apenas professores, coordenação e administração — por isso fisioterapeuta e nutricionista não aparecem.

Passar a usar a mesma fonte já utilizada na Carteira de Alunos, que inclui todos os perfis (professor, nutricionista, fisioterapeuta, coordenação e administração), ordenada por nome. Nada mais muda: "Minhas tarefas", "Todos os profissionais" e o comportamento do filtro continuam iguais.

## 2. Reabilitações futuras sem tarefa

Situação verificada no banco: existem 4 agendamentos de Reabilitação com data futura e aluno vinculado, todos da mesma profissional, e apenas 2 tarefas de relatório de reabilitação existem hoje. A regra automática só vale para agendamentos criados depois que ela entrou no ar.

Ação: aplicar a regra retroativamente nesses agendamentos futuros, criando a tarefa programada do relatório de Evolução para a profissional responsável — mesma data e horário final do atendimento, mesmo título, mesmo botão "Realizar" e mesma conclusão automática ao registrar a nova sessão. Sem duplicar onde a tarefa já existe.

Agendamentos passados não recebem tarefa.

## Detalhes técnicos

- `src/pages/TaskCenter.tsx`: substituir a query `taskcenter-professors` (user_roles + profiles com filtro de 3 papéis) por `supabase.rpc("fn_listar_profissionais")`, mantendo ordenação por `full_name` e o filtro que remove o próprio usuário.
- Backfill de dados (não é migration): `INSERT INTO tarefas` replicando a lógica de `fn_tarefa_reabilitacao_agendada()` — responsável `COALESCE(profissional_id, alunos.responsavel_id)`, `data_limite = data_especifica`, `hora_limite = horario_fim`, `tipo_auto = 'relatorio_reabilitacao'`, `automatica = true`, `status = 'pendente'`, com `NOT EXISTS` por aluno + tipo_auto + data_limite.
- Verificação: contagem das tarefas `relatorio_reabilitacao` após o backfill e conferência na tela.
