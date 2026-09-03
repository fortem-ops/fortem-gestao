# Mostrar a rotação torácica no mapa corporal

## Diagnóstico confirmado
- No banco existem duas formas articulares calibradas: `toracica-direito` e `toracica-esquerdo` (ambas na vista posterior, 6 pontos cada).
- O código de mobilidade (`shapeMuscleMapping.ts`) mapeia "Mobilidade Torácica" para uma única articulação central de chave `toracica`, que **não existe** no banco.
- Por isso o mapa não encontra forma alguma para a métrica e nada é pintado.

## Correção proposta
1. Em `shapeMuscleMapping.ts`, trocar o mapeamento de "Mobilidade Torácica" de `{ center: "toracica" }` para `{ left: "toracica-esquerdo", right: "toracica-direito" }`.
2. Atualizar a lista `MOBILIDADE_ARTICULATION_OPTIONS` (usada no vínculo de exercícios de mobilidade) substituindo a opção única "Coluna torácica" por "Torácica esquerda" e "Torácica direita".
3. Nenhuma mudança de banco: as formas já estão calibradas e continuam sendo a fonte visual.

## Resultado esperado
Na camada Mobilidade da vista posterior, a rotação torácica passa a pintar os dois lados com a cor da assimetria do par, igual às demais articulações (ombro, quadril, tornozelo).

## Riscos
- Se algum exercício já estiver vinculado à chave antiga `toracica`, ele deixa de casar com uma opção da lista; como a lateralidade agora é obrigatória, esses vínculos devem ser revistos no Banco de Exercícios (verificação rápida antes de aplicar).
