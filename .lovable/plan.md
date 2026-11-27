# Incluir aluno no horário: só ativos e créditos de planos antigos

## O que muda para a equipe
1. **Lista de alunos ao incluir no horário**: mostra apenas alunos ativos de fato — cadastro "ativo", fora da equipe e com plano ou contrato vigente hoje (incluindo Wellhub/TotalPass). Leads, prospects, inativos, avulsos e quem está "ativo" sem plano vigente deixam de aparecer.
2. **Créditos de alunos com planos antigos (antes de 2027)**: ao selecionar o aluno, aparece o saldo de treinos dele, como já acontece nos planos 2027.
   - Total do plano anual pela frequência: 1x = 52, 2x = 104, 3x = 156 (proporcional quando o contrato tiver outra duração).
   - Usados = treinos agendados/realizados (não cancelados) dentro do período do contrato vigente, incluindo os horários fixos já lançados.
   - Livre (Seg–Sex) continua "não consome créditos"; agregadoras continuam sem saldo numérico.
   - Texto: "X créditos restantes de Y" com o nome do plano.

## O que fica igual
Planos 2027 (ciclos de crédito), inclusão sem limite para Admin/Coordenador, exclusão com escolha de estorno, portal do aluno e regras de débito.

## Detalhes técnicos
- Achado: os contratos antigos não têm linhas em `ciclos_credito` (ex.: contrato Power 3x ativo sem ciclo), e `fn_saldo_creditos_treino_aluno` só soma ciclos, por isso retorna 0. Hoje 119 alunos com status ativo não têm ciclo ativo.
- Migration nova substituindo só `fn_saldo_creditos_treino_aluno`: quando não houver ciclo ativo, usar o contrato ativo vigente (`contratos.frequencia_semanal`, `data_inicio`, `data_fim`) para o total e contar `treino_agendamentos` do aluno no período com status diferente de cancelado. Plano principal continua vindo de `fn_plano_principal_ativo`. Retorna `origem: 'legado'`.
- Nova RPC `fn_alunos_agendaveis_equipe()` (SECURITY DEFINER, search_path fixo, só admin/coordenador, sem anon) que devolve id/nome dos alunos ativos com plano/contrato vigente; `IncluirAlunoHorario.tsx` passa a usá-la.
- Testes: regressão para aluno legado 3x (156 menos usados), Livre, agregadora e filtro da lista; ensaio SQL revertido com fixtures; `bunx vitest run` e eslint nos arquivos alterados.
