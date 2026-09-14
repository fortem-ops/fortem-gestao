# Mostrar brinde escolhido nas Encomendas

## Contexto
- A aba Encomendas (`src/components/loja/EncomendasTab.tsx`) lista encomendas pagas com cliente, modelo, cor, tamanho, data, quantidade e valores, mas não exibe o brinde da campanha.
- A coluna `pedidos.brinde_escolhido` já existe e a aba Pedidos já a consulta e exibe como badge (`PedidosTab.tsx`, linhas 45/187/259/292).

## Mudança (somente frontend, `EncomendasTab.tsx`)
1. Consulta: incluir `brinde_escolhido` no select de `pedidos` e no tipo `PedidoRow`.
2. Linha: repassar `brindeEscolhido: p.brinde_escolhido ?? null` no tipo `Linha`.
3. Exibição: no menu da coluna Cliente (junto do badge do cupom), renderizar um badge "Brinde: {nome}" quando houver — mesmo padrão visual do badge de cupom (`variant="outline"`, texto pequeno), com ícone de presente (lucide `Gift`).
4. Busca: incluir o nome do brinde no alvo da busca por texto, para localizar encomendas pelo brinde.

## Mudança 2 — card do cupom 20OFF no carrinho (`StoreCart.tsx`)
1. Dentro do card "Cupom de desconto", acima do campo de digitação, exibir um card/sugestão destacada: "20% OFF com o cupom 20OFF" com botão "Aplicar".
2. O botão preenche "20OFF" e chama `aplicarCupom("20OFF")` diretamente (mesma lógica já usada pela faixa da vitrine).
3. Visibilidade: somente quando nenhum cupom estiver aplicado e a data estiver dentro da validade (até 27/09 23:59, horário de Brasília — mesma constante `CUPOM_20OFF_LIMITE` já usada na vitrine, extraída para um local compartilhado para não duplicar o valor).
4. Quando o cupom 20OFF já estiver aplicado, o card some (o estado "aplicado" existente cobre a confirmação).

## Mudança 3 — fotos dos brindes sem corte (garrafa)
- Hoje as miniaturas dos brindes usam `object-cover` em caixa quadrada (banner em `BrindeBanner.tsx` e escolha no `CheckoutFlow.tsx`), o que corta a garrafa.
- Trocar para `object-contain` com padding interno nas duas telas, mantendo o fundo e o arredondamento atuais, para mostrar o brinde inteiro.

## Não alterar
- Filtros, rateio de valores, exclusão, agrupamento por modelo e demais telas da Loja permanecem como estão.

## Verificação
- `bunx tsgo --noEmit`.
