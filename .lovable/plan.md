# Reorganizar layout do mapa corporal no modo Resultados

## Objetivo
Ajustar a disposição dos elementos na aba **Assimetrias** do modo **Resultados** para seguir o alinhamento do desenho: cards de métricas no topo direito, controles do mapa no topo esquerdo, mapas corporais ocupando a área principal à esquerda e o filtro de visão + "Pontos de atenção" alinhados à direita.

## Estado atual
- `BodyMap.tsx` renderiza tudo dentro de um único card: título + badge + anéis na mesma linha, depois seletor de camada, depois grid com mapa à esquerda e Pontos de atenção à direita, e escala/visões dentro da coluna do mapa.
- `PremiumBodyMap.tsx` envolve `BodyMap` e repassa `rings`/`canonical`.
- `BodyMap` também é usado em `FuncionalV2Viewer.tsx` e `FuncionalV2Assessment.tsx`, que devem manter o layout atual.

## Mudanças propostas
1. **Adicionar prop de layout em `BodyMap.tsx`**
   - `layout?: "default" | "resultados"` (padrão `"default"`).
   - Layout `"default"`: manter exatamente como está hoje.
   - Layout `"resultados"`: nova estrutura em grid.

2. **Novo layout `"resultados"`**
   - **Linha superior** (grid de 2 colunas):
     - Esquerda: título "Mapa Corporal", badge de risco, contagem de assimetrias, seletor de camada e escala de assimetria.
     - Direita: cards "Assimetrias" (Mobilidade/Flexibilidade/Força) e "Risco de Lesões" (>20% / 10–20% / <10%).
   - **Linha inferior** (grid de 2 colunas):
     - Esquerda: `BodyMapSVG` (vistas anterior/posterior) ocupando a largura disponível.
     - Direita: botões "Ambos / Anterior / Posterior" + painel "Pontos de atenção".
   - Manter texto explicativo e bloco "Cadeias compensatórias" abaixo do grid, quando houver.

3. **Ativar novo layout em Resultados**
   - Em `PremiumBodyMap.tsx`, passar `layout="resultados"` para `BodyMap`.
   - Verificar se `PremiumBodyMap` precisa de ajustes de padding/borda para não duplicar card com o container de `AvaliacoesPremium.tsx`.

4. **Preservar outros usos**
   - `FuncionalV2Viewer.tsx` e `FuncionalV2Assessment.tsx` continuam sem a prop `layout`, portanto no layout `"default"`.

## Arquivos envolvidos
- `src/components/student/assessment/funcionalV2/BodyMap.tsx`
- `src/components/avaliacoes-premium/PremiumBodyMap.tsx`

## Riscos e cuidados
- Quebrar o layout padrão usado no lançamento/viewer antigo → mitigado pela prop `layout`.
- Responsividade: em telas médias/pequenas, empilhar as colunas verticalmente (grid `lg:grid-cols-2` ou similar).
- Garantir que o seletor de data global e a navegação por abas (ResultadosNav) não sejam afetados.

## Validação
- `bunx tsc --noEmit`.
- Build do projeto.
- Verificar visualmente no preview o modo Resultados › Assimetrias.
