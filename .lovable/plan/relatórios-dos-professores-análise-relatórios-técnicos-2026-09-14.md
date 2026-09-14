# Relatórios dos Professores (Análise > Relatórios > Técnicos)

Tela para coordenação e administração acompanharem os relatórios técnicos que cada professor deve preencher, mais a geração automática das tarefas nos prazos definidos.

## Duas categorias e seus prazos

- **Treinos de Força** — um relatório por mês, previsto para o dia 1 de cada mês.
- **Treinos de Corrida** — dois por mês, previstos para os dias 1 e 15.

O relatório de cada ciclo conta como entregue quando o professor preenche o Relatório Técnico do aluno com data dentro do ciclo. Passou da data prevista sem preenchimento, fica **Em atraso**.

Hoje existe um único tipo "Relatórios Técnicos" (usado como Força). Será criado o tipo **Relatório Técnico — Corrida**, com o mesmo formato do atual, para separar as duas categorias.

## Alunos de Corrida vão para a Yasmim

Todo aluno ativo com plano de Corrida (principal ou adicional) tem seus relatórios de Corrida atribuídos à **Yasmim Rodrigues Avila** — tanto a tarefa gerada quanto a linha do relatório. O responsável geral do aluno na carteira não é alterado, para não afetar comissionamento nem outras telas.

## Tarefas automáticas para os professores

Nos dias 1 e 15, o sistema cria automaticamente as tarefas pendentes:

- Dia 1: "Relatório Técnico — Força" para cada aluno ativo (responsável: professor do aluno) e "Relatório Técnico — Corrida" para cada aluno de Corrida (responsável: Yasmim).
- Dia 15: apenas as de Corrida.

A tarefa tem data limite igual à data do ciclo, aparece na Central de Tarefas e no painel do professor, e leva direto para Relatórios > Relatório Técnico do aluno. Não há duplicidade: se a tarefa do ciclo já existe ou o relatório já foi preenchido, nada é criado. Ao preencher o relatório, a tarefa do ciclo é concluída sozinha.

## O que a tela mostra

Uma linha por aluno ativo e categoria, com:

- Nome do aluno (link para a ficha)
- Categoria (Força / Corrida)
- Professor responsável pelo relatório
- Ciclo atual e data prevista
- Situação: Entregue, Pendente (dentro do prazo) ou Em atraso
- Data do último relatório entregue e quem preencheu
- Dias desde o último relatório

Cartões de resumo no topo: alunos acompanhados, entregues no ciclo, pendentes, em atraso e percentual de conclusão. Também uma visão agrupada por professor com entregues x em atraso.

## Filtros

Busca por nome, professor responsável, categoria, situação, ciclo (atual ou anteriores) e ordenação por atraso ou nome.

## Acesso

Somente coordenadores e administradores; professores veem a mensagem de acesso restrito.

## Detalhes técnicos

- Nova página `src/pages/relatorios/Tecnicos.tsx` substituindo o `EmBreve` na rota `/relatorios/tecnicos` em `src/App.tsx`.
- Migration:
  - Novo registro em `avaliacao_tipos` (`relatoriocorrida`, engine `dinamico`) e cópia do schema de `avaliacao_templates` do tipo `relatorioforca`.
  - Função `fn_gerar_tarefas_relatorio_tecnico(_data date)` que, para alunos `status = 'ativo'`, insere tarefas em `tarefas` com `origem = 'tecnico'` e `tipo_auto` `relatorio_tecnico_forca` / `relatorio_tecnico_corrida`, `data_limite` = data do ciclo, `responsavel_id` = `alunos.responsavel_id` (Força) ou Yasmim (Corrida, resolvida por `profiles.full_name`), idempotente por aluno + tipo + ciclo.
  - Corrida detectada por `planos.ativo` com `atividade = 'corrida'` (principal ou adicional).
  - Trigger em `avaliacoes` que conclui a tarefa do ciclo ao finalizar o relatório correspondente.
  - Dois agendamentos `pg_cron`: `0 9 1 * *` (Força + Corrida) e `0 9 15 * *` (Corrida). Rodam duas vezes por mês, no horário da manhã; sem custo relevante de execução contínua.
- Frontend: TanStack Query sobre `alunos`, `planos`, `avaliacoes` (tipos `relatorioforca` e `relatoriocorrida`), `tarefas` e `profiles`; agregação de ciclos e filtros no cliente (240 alunos ativos).
- `getTaskActionTarget` em `src/lib/taskAction.ts` ganha os novos `tipo_auto`, apontando para a aba de relatórios do aluno.
- Permissão via RPC `is_coordinator_or_admin`, no padrão de `AdminPonto.tsx`.
- Nenhuma outra aba de Relatórios, o preenchimento atual de relatórios ou a carteira de alunos são alterados.
