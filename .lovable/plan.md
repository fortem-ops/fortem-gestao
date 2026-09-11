# Manter a ordem do Banco de Exercícios na hora de prescrever

Hoje a lista de exercícios que aparece na prescrição vem em ordem alfabética, ignorando a ordem que foi configurada (arrastando) no Banco de Exercícios.

## O que muda

- Na seleção de exercícios durante a prescrição do treino, os exercícios passam a aparecer na mesma ordem definida no Banco de Exercícios.
- Mesma correção na seleção de exercícios dentro do Banco de Treinos (edição das fases/modelos).
- Quando dois exercícios tiverem a mesma posição, o desempate continua por nome.
- A busca por texto continua funcionando igual; só a ordem da lista muda.

## Detalhes técnicos

- `src/components/student/workout/ExerciseSelector.tsx` (query `exercicios-bank-selector`): incluir `ordem` no `select` e trocar `.order("nome")` por `.order("ordem", { ascending: true }).order("nome", { ascending: true })` — mesmo critério já usado em `StudentExerciseBank.tsx:139-140`.
- `src/pages/BancoTreinos.tsx` (query `exercicios-bank-templates`, ~linha 986): mesma alteração.
- Nenhuma mudança de banco de dados, RLS ou lógica de filtro por categoria/subcategoria.
