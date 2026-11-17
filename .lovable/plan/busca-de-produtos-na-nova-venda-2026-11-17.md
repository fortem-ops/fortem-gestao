# Busca de produtos na Nova Venda

Hoje a aba Produtos mostra todos os itens da Loja, sem como filtrar.

## O que muda
- No topo da aba **Produtos**, um campo "Buscar produto" com ícone de lupa.
- Ao digitar, a lista mostra só os produtos cujo nome (ou tamanho/cor da variante) contém o texto, sem diferenciar maiúsculas nem acentos ("camiseta" acha "Camiseta", "agua" acha "Água").
- Botão "x" limpa a busca. Sem resultado: "Nenhum produto encontrado".
- O carrinho não é afetado pela busca: itens já escolhidos continuam lá.

Observação: em vez de uma aba separada, o campo fica dentro de Produtos, porque é ali que se escolhe o item. Se preferir mesmo uma aba "Buscar" à parte, me diga.

## Detalhes técnicos
- Estado `busca` em `VendaProdutos.tsx`; filtro sobre `produtos` de `useProdutosLoja` com normalização NFD.
- Função `filtrarProdutos` em `src/lib/lojaBalcao.ts` + teste (acento, maiúsculas, variante, vazio).
- Rodar `bunx vitest run` e eslint.
