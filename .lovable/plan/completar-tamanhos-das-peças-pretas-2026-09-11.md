# Completar tamanhos das peças pretas

## Objetivo
Adicionar as variações **P, M, G, GG, XG, XGG e XXG** na cor preta para:

- Manga Longa - Feminina
- Manga Longa - Masculina
- Babylook
- Camiseta Tradicional

## Situação confirmada
Os quatro produtos já existem e atualmente possuem apenas o tamanho **P** na cor preta. As demais seis numerações estão ausentes em cada produto.

## Implementação
1. Criar uma migração de dados idempotente, adicionando apenas as combinações de cor e tamanho ainda inexistentes.
2. Reaproveitar em cada produto a grafia da cor, o código de cor, o preço e o estado ativo da variação preta já cadastrada.
3. Iniciar as novas variações com estoque zero, igual às variações pretas atuais, sem alterar estoques ou variantes existentes.
4. Aplicar a migração e conferir que cada um dos quatro produtos ficou com os sete tamanhos pretos, sem duplicidades.

## Resultado esperado
A administração e a Store exibirão todos os sete tamanhos pretos para os quatro modelos, respeitando a disponibilidade de estoque já usada pela Loja.
