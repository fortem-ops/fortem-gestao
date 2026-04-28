## Ajuste em Observações no PDF de Treino

Em `src/components/student/workout/exportWorkoutPDF.ts`, no bloco "OBSERVAÇÕES":

1. **Reduzir espaçamento título → primeira linha**: hoje há um respiro extra de ~2mm entre o título e a primeira linha. Removê-lo para que o gap fique igual ao espaçamento entre as demais linhas (`OBS_LINE_GAP = 4.2mm`).
2. **Adicionar uma linha**: passar de 3 para 4 linhas de escrita.
3. Manter as linhas pretas (`INK`, `lineWidth: 0.15`) e o título inalterado.

Resultado: título "OBSERVAÇÕES" seguido de 4 linhas pretas perfeitamente equidistantes (4,2mm cada), sem o respiro extra atual.
