# Aviso do treino experimental abre o relatório certo

## Problema
No painel, o aviso "Você ainda não realizou a avaliação do treino experimental do aluno X" leva o professor para a tela de Avaliações do aluno. O certo é abrir direto o novo relatório do tipo **Experimental**, já com o prospect selecionado.

## O que muda
- Clicar no aviso de **treino experimental** abre "Novo Relatório — [nome do prospect]" com o tipo **Experimental** já escolhido.
- O professor só escolhe o modelo (aula experimental ou aula experimental de corrida) e preenche.
- O aviso de **Avaliação Funcional** (mobilidade/força) continua indo para Avaliações, como hoje.
- Ao salvar o relatório, o aviso some sozinho (comportamento atual).

## Detalhes técnicos
- `src/components/dashboard/LembreteAvaliacoesPendentesBanner.tsx`: `handleClick` passa a receber o item; para `atividade === "Treino Experimental"` navega para `/avaliacoes?aluno=<id>&new=1&tipo=experimental`; demais seguem `/avaliacoes-premium/<id>`.
- Extrair a escolha do destino para uma função pura (`destinoLembrete`) e cobrir com teste de regressão em `src/test/` (experimental → relatório; funcional → avaliações).
- Rodar `bunx vitest run` e `bunx eslint` no arquivo alterado; precisa de Publish.
