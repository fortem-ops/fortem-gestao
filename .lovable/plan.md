# Mover grupo para dentro de outro — comportamento confirmado

## Contexto

Ao arrastar um grupo (ex: "Mobilidade Articular") para dentro de outro (ex: "Preparação Movimento"), o diálogo mostra a contagem de exercícios e subcategorias que serão movidos.

## Regra confirmada

- **O grupo de origem vai junto**: todos os exercícios e todas as subcategorias do grupo de origem são movidos para o grupo de destino.
- As subcategorias mantêm os mesmos nomes (sem prefixo); se já existir subcategoria com o mesmo nome no destino, os exercícios são unidos nela.
- O grupo de origem deixa de existir após a movimentação (o nome não vira subcategoria).

## Ação

Nenhuma alteração de código. Esse já é o comportamento implementado na RPC `fn_mover_grupo_para_grupo` e no drag-and-drop do `ManageCategoriesDialog.tsx`. A migração de "Mobilidade Articular" → "Preparação Movimento" pode ser feita pelo próprio diálogo de arrastar.
