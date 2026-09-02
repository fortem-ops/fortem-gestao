# Risco de Lesões baseado somente em Força

## Problema
O card "Risco de Lesões" (Mapa Corporal, modo Resultados) hoje soma as assimetrias de **todas as camadas** — mobilidade + flexibilidade + força. Por isso as contagens `>20% / 10-20% / <10%` não batem com os 6 exercícios de dinamometria executados.

Confirmado no código:
- `PremiumBodyMap` passa `rings` vindo de `assimetriasPorCategoria`, onde `geral = mob + flex + forcaPcts`.
- `BodyMap` usa `rings.geral.alta / moderada / baixa` nos três anéis do card de risco.
- `rings.forca` já existe e é calculado apenas com os exercícios de força (`classifyForca` por exercício com lado direito e esquerdo preenchidos).

## Mudança
1. No card "Risco de Lesões" do `BodyMap`, trocar a fonte dos três anéis de `rings.geral` para `rings.forca`.
2. Atualizar o subtítulo de "saúde muscular · todas as camadas" para algo como "assimetria de força · dinamometria".
3. Nada mais muda: o card "Assimetrias" (Mobilidade / Flexibilidade / Força) e o modo Lançamento permanecem iguais.

Com 6 exercícios avaliados, o card passará a mostrar exatamente a distribuição desses 6 (no exemplo: 0 / 1 / 5).

## Fora do escopo
- O card de risco do `DashboardSummary` (`DashboardRiscoCard`), que continua com a contagem geral — pode ser alinhado depois se desejado.
