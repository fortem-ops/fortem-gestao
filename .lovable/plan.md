# Remover prefixos numéricos dos nomes dos exercícios no PDF

## Objetivo
Ao exportar o PDF, nomes como `4-Agachamento com Barra nas Costas` devem aparecer como `Agachamento com Barra nas Costas`. A mudança é cosmética apenas no PDF — não altera o nome salvo no banco de dados nem na tela.

## Mudança
Arquivo: `src/components/student/workout/exportWorkoutPDF.ts`

1. Adicionar uma função utilitária `cleanExerciseName(name: string)` que remove prefixos numéricos do início do nome. Regex: `/^\s*\d+\s*[-–—.)]\s*/` — cobre formatos comuns como `4-`, `4 -`, `4.`, `4)`, `4 –`.

2. Substituir os dois usos de `ex.exercicio` (linhas 298 e 399 — aquecimento e treinos de força) por `cleanExerciseName(ex.exercicio)`.

## Fora do escopo
- Não altera `BancoTreinos`, `PersonalizadoEditor`, importação ou qualquer dado persistido.
- Não mexe em outras colunas (CAT, REP, etc.).
