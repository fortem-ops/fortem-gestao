# Reposicionar escala de assimetria e visões no quadrante do Mapa Corporal

## Contexto
Em `src/components/student/assessment/funcionalV2/BodyMap.tsx`, a escala de assimetria (`AsymmetryGradientLegend`) e os botões de visão (`Ambos/Anterior/Posterior`) atualmente ficam em uma linha de controles acima do seletor de camada, separados do título "Mapa Corporal".

## Objetivo
Deixar a escala de assimetria e as visões abaixo do título "Mapa Corporal", dentro do mesmo quadrante do mapa corporal (coluna esquerda do grid), alinhados entre si e com o conteúdo do mapa.

## Mudanças propostas
1. **Mover controles para dentro do quadrante do mapa**
   - Remover a linha de controles atual (`Controls row 1`) do fluxo entre header e seletor de camada.
   - Inserir a escala de assimetria e os botões de visão logo abaixo do cabeçalho de título, dentro da coluna esquerda (onde fica o `BodyMapSVG`).

2. **Alinhar horizontalmente**
   - Agrupar escala e visões em um container flexível (`flex items-center justify-between`) para que fiquem na mesma linha, ocupando a largura do quadrante do mapa.
   - Manter a escala visível apenas em telas médias/grandes (`hidden md:flex`) como está hoje.

3. **Preservar funcionalidade**
   - Manter o estado `viewFilter` e a lógica de alternância (`Ambos/Anterior/Posterior`).
   - Manter o componente `AsymmetryGradientLegend` sem alterar seu conteúdo.
   - Não alterar o seletor de camada (`Controls row 2`) nem o painel lateral de pontos de atenção.

## Resultado esperado
- Título "Mapa Corporal" + badge de risco no topo da coluna esquerda.
- Abaixo do título: escala de assimetria à esquerda e botões `Ambos/Anterior/Posterior` à direita, alinhados na mesma linha.
- Abaixo disso: o SVG do corpo e, ao lado, o painel "Pontos de atenção".
- Layout mais compacto e visualmente integrado.

## Arquivos envolvidos
- `src/components/student/assessment/funcionalV2/BodyMap.tsx`
