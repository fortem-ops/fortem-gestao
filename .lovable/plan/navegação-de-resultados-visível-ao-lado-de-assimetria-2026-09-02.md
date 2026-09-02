# Navegação de Resultados visível ao lado de Assimetria

## Situação atual (verificada no código)

Existem hoje dois grupos de botões diferentes em Resultados:

1. **Modos do Mapa Corporal** (dentro do `BodyMap`): "Assimetria" e demais modos — é este botão "Assimetria" que aparece junto ao mapa.
2. **Navegação de seções** (`ResultadosNav`, com Assimetria / Composição / Pliometria / Evolução / Comparativo / Recomendações): está renderizada no cabeçalho do card de Resultados, alinhada à direita, separada do bloco do mapa (`justify-between` ao lado do rótulo "Resultados").

Ou seja, a barra existe, mas não fica ao lado do botão "Assimetria" do mapa — por isso a impressão de que sumiu.

## O que fazer

- Tornar a barra de seções o elemento principal do cabeçalho do card: alinhá-la à esquerda, logo abaixo/junto do rótulo, com destaque visual (pills maiores, estado ativo mais contrastado) para não passar despercebida.
- Aumentar o contraste dos itens inativos (hoje `text-white/55`), que somem no fundo escuro.
- Garantir quebra de linha adequada no mobile (`flex-wrap`) sem cortar itens.
- Renomear o item "Assimetria" da barra de seções para "Assimetrias" (plural), evitando confusão com o modo "Assimetria" do mapa.

## Detalhes técnicos

- `src/components/avaliacoes-premium/ResultadosNav.tsx`: ajustar classes (tamanho, contraste do estado inativo/ativo) e o rótulo do primeiro item.
- `src/pages/AvaliacoesPremium.tsx` (linhas ~167-170): cabeçalho do card passa de `justify-between` para uma coluna — rótulo "Resultados" em cima, `ResultadosNav` em largura total abaixo.
- Nenhuma alteração no modo Lançamento nem no `BodyMap`.
