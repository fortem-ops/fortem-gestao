# Legenda de lados na Evolução (Avaliações Premium)

## Problema
Na aba Evolução, cada métrica lateralizada gera duas linhas com a MESMA cor: contínua e tracejada. Os nomes no legend do Recharts trazem "(E)" e "(D)", mas não há nada explicando o significado das siglas nem qual estilo (contínuo/tracejado) corresponde a cada lado — o legend do Recharts também não reproduz o tracejado, então os dois itens parecem idênticos.

## Solução
Legenda fixa explicando estilo de linha + sigla, exibida uma única vez acima dos gráficos.

### 1. Novo estilo na `LadoLegend` (`src/components/avaliacoes-premium/LadoLegend.tsx`)
- Adicionar variante `traco` (nova prop ou novo export) que renderiza:
  - Amostra de linha **contínua** + texto "Contínua = Esquerdo (E)"
  - Amostra de linha **tracejada** + texto "Tracejada = Direito (D)"
- Amostras desenhadas com um pequeno SVG inline (mesma largura, `strokeDasharray="5 4"` no tracejado) usando cor neutra do tema (`hsl(var(--bio-ink))`), pois no gráfico a cor varia por métrica — o que diferencia os lados é o estilo do traço.
- Manter o mesmo visual da variante expandida atual (borda, fundo `bio-surface-2`, tamanho de texto 11–12px). Variantes existentes (`compact` e padrão) inalteradas.

### 2. Integração em `EvolucaoTab.tsx`
- Renderizar a `LadoLegend` variante `traco` logo abaixo do `EvolucaoSeletor` e acima do primeiro gráfico.
- Exibir apenas quando houver pelo menos um gráfico lateralizado (id `mobility`, `flexibility` ou `forca` com séries ativas). Composição e Pliometria não têm lados, então não justificam a legenda.

## Fora de escopo
- Mudança de cores por lado (mantém paleta atual, uma cor por métrica).
- Modo Lançamento, demais abas (Mobilidade/Força já usam `LadoLegend` compacta) e backend.

## Validação
- `bunx tsgo --noEmit` + build.
- Conferência visual na aba Evolução com aluno que tenha métricas laterais: legenda visível uma vez, contínua/tracejada distinguíveis.
