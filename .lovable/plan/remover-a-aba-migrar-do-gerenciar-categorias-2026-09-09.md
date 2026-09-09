# Remover a aba "Migrar" do Gerenciar Categorias

## Objetivo
Remover a aba "Migrar" da janela "Gerenciar Categorias" (Banco de Exercícios), pois não está funcional.

## Alterações
Arquivo único: `src/components/student/ManageCategoriesDialog.tsx`

1. Remover a entrada `{ key: "migrar", label: "Migrar" }` da lista de abas (linha ~576).
2. Remover todo o bloco da aba MIGRAR (linhas ~1122–1306): formulário de origem/destino, checkbox "Excluir a pasta de origem após migrar" e o botão "Migrar exercícios".
3. Remover o handler `handleMigrar` (linhas ~421–462) e os estados exclusivos da migração (`origGrupo`, `origCat`, `origSub`, `destGrupo`, `destCat`, `destSub`, `excluirOrigem`, `preview` e derivados), o tipo `"migrar"` do estado `tab`, e a desestruturação de `migrar` do hook `useExerciseCategories` (linha ~89) — a mutation continua existindo no hook, apenas deixa de ser usada aqui.
4. Remover imports que ficarem sem uso (ex.: `ArrowRight`, `Checkbox` se usados só nessa aba).

## O que não muda
- Abas Grupos, Categorias e Subcategorias continuam idênticas.
- Nenhuma alteração em banco de dados, RPCs ou no hook `useExerciseCategories` (a função de migração fica disponível caso seja reativada no futuro).

## Verificação
- Typecheck (`bunx tsgo --noEmit`) sem erros.
- Conferir no preview que a janela mostra apenas 3 abas e que as demais funcionam.
