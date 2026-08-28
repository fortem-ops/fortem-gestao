# Corrigir prescrições após grupos virarem categorias

## O que aconteceu

Os dados estão intactos no banco. O problema é de resolução de nomes na prescrição.

"Liberação Miofascial", "Mobilidade Articular", "Ativação Muscular" e "Preventivo" deixaram de ser **grupos** e passaram a ser **categorias** dentro de "Preparação movimento". A prescrição (blocos de aquecimento LIB / MOB / ATI / PREV e os seletores de exercício) ainda procura esses nomes como **grupo**. Como nenhum grupo com esse nome existe mais, a lista de exercícios volta vazia e as subcategorias somem.

Há ainda um segundo efeito: nomes de subcategoria repetidos em categorias diferentes (por exemplo "Quadril" existe em Ativação, Liberação e Mobilidade). Sem considerar a categoria, o sistema casa com a primeira ocorrência e mostra a lista errada.

## O que será feito

1. Os blocos de aquecimento passam a apontar para a **categoria** correspondente (dentro de qualquer grupo), não mais para um grupo com aquele nome.
2. A busca de exercícios passa a filtrar por Grupo + Categoria + Subcategoria, resolvendo o nome em qualquer um dos três níveis. Se o nome existir só como categoria, funciona; se existir só como grupo (dados antigos), continua funcionando.
3. Os selects de subcategoria dos blocos de aquecimento voltam a listar as subcategorias da categoria correta.
4. Nenhuma prescrição salva precisa ser alterada — os códigos LIB/MOB/ATI/PREV e os nomes de subcategoria continuam válidos.

## Detalhes técnicos

- `src/lib/exerciseMapping.ts`: novo `CODE_TO_CATEGORIA` (LIB/MOB/ATI/PREV → nome da categoria) e nova função `resolverAlvo(value, tree)` que devolve `{ grupo, categoria, subcategoria }` procurando o valor, nesta ordem: código conhecido → subcategoria na árvore → categoria na árvore → grupo na árvore → fallback literal. `categoriaToGrupoSub` é mantida como wrapper para chamadas legadas.
- `src/components/student/workout/ExerciseSelector.tsx`: usa `tree` de `useExerciseCategories` e `resolverAlvo`; o filtro passa a comparar `g.grupo`, `(g.categoria ?? g.grupo)` e `g.subcategoria`, ignorando os níveis não resolvidos.
- `src/pages/BancoTreinos.tsx`: `aquecimentoGrupoMap` vira mapa de categoria; os selects de subcategoria dos blocos LIB/MOB/ATI leem `tree` para achar a categoria e listar suas subcategorias; os placeholders usam o nome resolvido.
- `src/components/student/workout/AuxiliaresBlock.tsx` e os editores `Prescricao531Editor.tsx`, `PrescricaoM102Editor.tsx`, `PrescricaoPlanStrongEditor.tsx`, `PersonalizadoEditor.tsx`: passam a categoria resolvida ao `ExerciseSelector` onde hoje passam só o código/grupo.
- Sem migração de banco e sem alteração em treinos já salvos.
- Testes: casos novos para `resolverAlvo` (nome como categoria, nome duplicado em categorias diferentes, código legado) e execução da suíte completa ao final.
