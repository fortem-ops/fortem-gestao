# Fotos da história: 5 fotos por linha

## O que muda
- Na aba "Fotos da história", cada ano mostra até 5 fotos por linha no computador (hoje são 3), com miniaturas menores.
- Em telas menores: 2 fotos por linha no celular e 3 a 4 em telas médias.
- Arrastar para ordenar, setas, curtidas, comentários e botões continuam iguais, só em tamanho mais compacto (textos e botões menores, com área de toque preservada).

## Fora deste pedido
A página pública /10anos, os dados das fotos, a ordem salva e nada de Planos, cobranças ou Pix mudam. Nada é publicado.

## Detalhes técnicos
- `FestaFotosAdmin.tsx`: grade passa de `sm:grid-cols-2 lg:grid-cols-3` para `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5`, `gap-3`; cartão com textos `text-xs` e espaçamento reduzido.
- Conferir com Playwright em 1280px e 390px.
