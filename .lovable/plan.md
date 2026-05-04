# Reordenar exercícios por arrastar-e-soltar

Substituir os botões de seta ↑/↓ por uma interação de arrastar o card do exercício até a posição desejada na lista, dentro da subcategoria.

## Comportamento

- Apenas Coordenadores e Administradores veem a alça de arrastar (ícone de "grip" à esquerda do card).
- O usuário clica e segura na alça, arrasta o card para cima ou para baixo na lista, e solta na posição desejada.
- Durante o arrasto: o card original fica com opacidade reduzida e uma linha-guia indica onde o card será inserido.
- Ao soltar: a nova ordem é persistida no banco (campo `ordem`) recalculando os valores apenas dos exercícios da subcategoria atual, e a lista é atualizada otimisticamente para evitar "pulo" visual.
- Funciona apenas na visão de subcategoria (onde a ordem faz sentido). Nos resultados de busca/filtro, a alça não aparece.
- Acessibilidade: a alça mantém o `aria-label` e o card permanece clicável para vídeo/editar/excluir normalmente.

## Detalhes técnicos

- Usar HTML5 Drag and Drop nativo (sem nova dependência): `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`.
- Em `StudentExerciseBank.tsx`:
  - Remover botões `ArrowUp`/`ArrowDown` e a função `moveExercise`.
  - Adicionar ícone `GripVertical` como alça de arrasto (cursor `grab` / `grabbing`).
  - Estado local `draggingId` e `dragOverId` para feedback visual (opacidade + borda superior/inferior indicando posição alvo).
  - Nova função `reorderTo(list, fromId, toId, position: "before" | "after")` que monta o array reordenado e dispara uma mutation que reescreve `ordem` (incrementos de 10) para todos os itens da lista — mais simples e robusto que swaps individuais.
  - Substituir `reorderMutation` (que faz swap par-a-par) por uma versão que aceita uma lista `{ id, ordem }[]` e aplica todos os updates; já existe esse formato, basta reusar.
  - Atualização otimista via `queryClient.setQueryData(["exercicios-personalizados"], ...)` para mover o card imediatamente, com `invalidateQueries` no `onSettled`.
- Tokens semânticos do design system para o realce (linha-guia em `border-primary`, opacidade no card arrastado).

## Arquivo afetado

- `src/components/student/StudentExerciseBank.tsx`
