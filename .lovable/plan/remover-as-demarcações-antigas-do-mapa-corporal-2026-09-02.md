# Remover as demarcações antigas do mapa corporal

## Objetivo
O mapa em Resultados ainda desenha os marcadores da geração anterior (halos circulares, números, linhas tracejadas de assimetria/cadeias e áreas invisíveis de clique) posicionados por coordenadas fixas — são as manchas circuladas na captura. A partir de agora, as únicas áreas destacadas devem ser as formas calibradas em **Config. Mapa Corporal**.

## O que muda
- Remover do mapa: halos radiais por região, marcadores numerados, linhas tracejadas de assimetria e as áreas invisíveis de tooltip por coordenada.
- Remover também as linhas de cadeia compensatória desenhadas sobre o corpo (o bloco de texto "Cadeias compensatórias" abaixo do mapa permanece).
- As formas de Mobilidade (articulações), Força e Flexibilidade continuam sendo renderizadas exatamente como calibradas em Config. Mapa Corporal, com as cores clean e o efeito de respiro.
- O tooltip/rótulo com métrica, lado e valor passa a ficar apenas nas próprias formas calibradas.
- A lista lateral "Pontos de atenção" e os demais painéis continuam iguais.

## Detalhes técnicos
- `src/components/student/assessment/funcionalV2/BodyMapSVG.tsx` — remover `RegionGlow`, `RegionNumber`, `RegionHit`, `Chains`, o bloco de linhas de assimetria, `REGION_GEOMETRY`/`mergeGeometry` e as props `overrides`/`numbering`; manter apenas silhueta + `shapeInstances`. Acrescentar tooltip acessível nas formas.
- `src/components/student/assessment/funcionalV2/BodyMap.tsx` — parar de ler `useBodyMapGeometry`/`numbering` e de repassar essas props.
- Verificar outros consumidores de `REGION_GEOMETRY` (ex.: editor/config) antes de excluir o objeto; se ainda for usado em Config, mantê-lo lá e apenas parar de usá-lo no mapa de Resultados.
- Sem mudanças em banco de dados ou no modo Lançamento.
