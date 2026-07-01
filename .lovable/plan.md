## Objetivo
Permitir reordenar exercícios via arrastar-e-soltar em duas áreas da prescrição de treino (`PersonalizadoEditor.tsx`):

1. **Força** — dentro de cada bloco (A, B, C...).
2. **Aquecimento** — dentro de cada uma das 4 seções: **LIB**, **MOB**, **ATI** e **PREV**.

Exemplo: mover o exercício da posição 4 para a 1.

## Regras de escopo (obrigatórias)
- Aquecimento: só reordena **dentro da mesma seção**. LIB só troca com LIB, MOB com MOB, ATI com ATI, PREV com PREV. Nunca cruza seções.
- Força: só reordena **dentro do mesmo bloco**, no mesmo treino. Não move entre blocos nem entre treinos.
- Variantes de exercício dinâmico ficam fora desta iteração.
- A numeração/ordem exibida se atualiza automaticamente após o drop e reflete no salvamento e na exportação/PDF.

## UX
- Uma alça `GripVertical` aparece à esquerda de cada linha (em Força, ao lado do `#`; em Aquecimento, no início da linha do exercício).
- Ao arrastar, a linha ganha leve destaque (opacidade + sombra). Ao soltar, a nova ordem é persistida imediatamente no estado do editor.
- Acessível via teclado (Espaço para pegar, setas para mover, Espaço para soltar) usando o `KeyboardSensor` do dnd-kit.

## Implementação técnica
Arquivo único: `src/components/student/workout/PersonalizadoEditor.tsx` (dnd-kit já está no projeto).

1. **Novas funções no editor**
   - `reorderExercicioForca(ti, bi, from, to)` — aplica `arrayMove` em `treinos[ti].blocos[bi].exercicios`.
   - `reorderAquecimento(bloco, from, to)` — aplica `arrayMove` em `aquecimento[bloco]` onde `bloco ∈ {LIB, MOB, ATI, PREV}`.

2. **Força**
   - Envolver o `<Table>` de cada bloco com `DndContext` (Pointer + Keyboard, `closestCenter`) e `SortableContext` (`verticalListSortingStrategy`).
   - Substituir o `<TableBody>` único por um `<tbody>` por exercício, para que exercícios dinâmicos (cabeçalho + variantes) se movam como um nó único.
   - Novo wrapper `SortableExercicioForca` usando `useSortable`, aplicando `transform`/`transition` ao `<tbody>` e passando o handle para a alça `GripVertical` renderizada dentro de `ExercicioRows`/`DinamicoRows`.
   - IDs sortable: `` `forca-${ti}-${bi}-${ei}` ``.

3. **Aquecimento**
   - Renderizar cada uma das 4 seções (LIB, MOB, ATI, PREV) com seu próprio `DndContext` + `SortableContext` — isolamento garante que arrastar em LIB nunca solta em MOB.
   - Novo wrapper `SortableAquecimentoItem` que envolve o card/linha do exercício de aquecimento e expõe o handle.
   - IDs sortable: `` `aq-${bloco}-${i}` `` (o prefixo por bloco reforça o isolamento).
   - Handler `onDragEnd` recebe o `bloco` por closure e chama `reorderAquecimento(bloco, from, to)`.

4. Sem mudanças de schema, backend ou formato salvo — `aquecimento[bloco]` e `bl.exercicios` continuam sendo arrays ordenados.

## Fora do escopo
- Arrastar entre blocos de Força ou entre seções de Aquecimento (bloqueado por regra).
- Reordenar blocos, treinos (abas) ou variantes internas de exercício dinâmico.