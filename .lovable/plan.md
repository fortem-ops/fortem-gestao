# Mover grupo para dentro de outro — comportamento confirmado

## Contexto

Ao arrastar o grupo "Mobilidade Articular" para dentro de "Preparação Movimento", o diálogo de confirmação exibe: 122 exercícios, 14 subcategorias mantidas com os mesmos nomes, e o grupo de origem deixa de existir.

## Decisão

- **Manter como está** (escolha do usuário): ao mover um grupo para dentro de outro, todas as subcategorias e exercícios vão juntos, com os mesmos nomes, sem prefixo; o grupo de origem é removido.

## Ação

Nenhuma alteração de código. A implementação atual (RPC `fn_mover_grupo_para_grupo` + drag-and-drop no `ManageCategoriesDialog.tsx`) já corresponde ao comportamento desejado. Pode executar a migração de "Mobilidade Articular" → "Preparação Movimento" pelo próprio diálogo.
