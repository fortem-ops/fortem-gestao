# Não repetir o nível quando categoria e subcategoria têm o mesmo nome

Depois de promover uma subcategoria a categoria (LPO, Coordenativo Corrida), a navegação ficou com o nome repetido: `Parte Principal > LPO > LPO > exercícios`.

## O que muda

Regra única: quando uma categoria tem **apenas uma** subcategoria e ela tem o **mesmo nome** da categoria, o nível extra deixa de aparecer na navegação. Clicar na categoria leva direto aos exercícios.

Resultado: `Parte Principal > LPO > exercícios` e `Parte Principal > Coordenativo Corrida > exercícios`.

Nada é alterado no banco: a estrutura continua existindo, apenas não é exibida. Se depois for criada uma segunda subcategoria dentro dessa categoria, o nível volta a aparecer normalmente, sem nenhuma correção manual.

Onde a regra vale:
- Banco de Exercícios (lista lateral e navegação por níveis)
- Seletor de exercícios na prescrição de treinos
- Banco de Treinos (agrupamento e filtros)

O modal "Gerenciar Categorias" continua mostrando a estrutura real (com a subcategoria), para que ela ainda possa ser renomeada ou usada como destino de migração.

## Detalhes técnicos

- Novo helper em `src/lib/exerciseMapping.ts`: `categoriaEhFolha(categoria)` — retorna `true` quando `categoria.subcategorias.length === 1` e o nome coincide (comparação normalizada, sem acento/caixa).
- `src/components/student/StudentExerciseBank.tsx`: ao clicar numa categoria folha, pular a view de subcategorias e ir direto à lista de exercícios, filtrando por `grupo + categoria` (sem exigir `subcategoria`); breadcrumb sem o nível repetido.
- `src/components/student/workout/ExerciseSelector.tsx` e `src/pages/BancoTreinos.tsx`: ao montar as opções/agrupamentos a partir de `tree`, omitir a subcategoria quando `categoriaEhFolha` for verdadeira; a gravação continua usando `{grupo, categoria, subcategoria}` completo, então nenhum exercício muda de lugar.
- Sem migração de banco e sem alteração em treinos já salvos.
- Testes: novos casos em `src/test/exerciseMapping.test.ts` para `categoriaEhFolha` (mesmo nome com acento/caixa diferente, duas subcategorias, subcategoria única com nome diferente), seguidos da suíte completa.
