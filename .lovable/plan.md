# Loja: "Esgotado" só quando realmente não há estoque

## Causa (confirmada no código)
Na página do produto, antes de escolher o tamanho nenhuma variação é considerada "selecionada", então o estoque é tratado como zero e a tela mostra "Esgotado" na foto e no botão. Ao escolher o tamanho, a variação aparece com estoque e o aviso some.

## Correção
- Enquanto o tamanho/cor ainda não foi escolhido, o produto só aparece como "Esgotado" se **nenhuma** variação tiver estoque (e não aceitar encomenda).
- Nesse estado, o botão mostra "Escolha o tamanho" em vez de "Esgotado".
- Depois da escolha, "Esgotado" aparece apenas se aquela variação específica estiver sem estoque. Tamanhos sem estoque continuam marcados como indisponíveis.

## Detalhes técnicos
- `src/pages/store/StoreProductDetail.tsx`: `esgotado` passa a considerar `precisaEscolher`; quando ainda falta escolha, usa "alguma variante com estoque ou encomenda". Ajustar textos do selo (linha ~210) e dos botões (~363, ~413).
- Extrair a regra para uma função pura em `src/lib` e criar teste de regressão (sem escolha + estoque em algum tamanho → não esgotado; todos zerados → esgotado; escolha sem estoque → esgotado; encomenda → nunca esgotado).
- Rodar `bunx vitest run` e `bunx eslint` nos arquivos alterados; conferir no celular.
