# Mostrar categorias (e não só subcategorias) ao criar/editar exercício

Hoje, na janela "Novo Exercício" / "Editar Exercício", depois de marcar o grupo (Aquecimento ou Parte Principal) aparece uma lista corrida com TODAS as subcategorias do grupo misturadas, sem indicar a que categoria pertencem. Isso causa dois problemas: é difícil achar a subcategoria certa e, quando duas categorias têm subcategoria com o mesmo nome (ex.: "Quadril" existe em Liberação Miofascial e em Mobilidade Articular), o sistema hoje "adivinha" a categoria e pode gravar a errada.

## O que muda

Na janela de cadastro/edição, dentro de cada grupo marcado, as opções passam a aparecer organizadas por categoria:

```text
Aquecimento
  Liberação Miofascial (9)   [Pé/Tornozelo] [Perna] [Joelho/Coxa] ...
  Mobilidade Articular (14)  [Quadril] [Torácica] ...
  Ativação Muscular (19)     ...
  Preventivo (7)             ...
  Potência (5)               ...

Parte Principal
  Força (20)                 ...
  Potência (3)               ...
  Cardio                     ...
  Coordenativo Corrida       ...
```

- Cada categoria vira um bloco com o nome e a quantidade de subcategorias.
- A escolha continua sendo uma subcategoria por grupo, agora sempre com a categoria correta gravada junto.
- Ao editar um exercício existente, a categoria e a subcategoria já salvas aparecem selecionadas no bloco certo.
- Categorias sem subcategorias reais (nome da subcategoria igual ao da categoria, como Cardio e Coordenativo Corrida) aparecem como um único botão com o nome da categoria.
- A regra que mostra "Articulações relacionadas" para exercícios de Mobilidade Articular continua igual, agora usando a categoria escolhida diretamente.

Nada muda no banco de exercícios em si, nem nos exercícios já cadastrados.

## Detalhes técnicos

Arquivo: `src/components/student/StudentExerciseBank.tsx`.

- Estado `selecoes: Record<string, string>` (grupo → sub) passa a `Record<string, { categoria: string; subcategoria: string }>`.
- A renderização da seção "Subcategoria por grupo" deixa de usar `CATEGORIES` (achatado) e passa a usar `tree` do `useExerciseCategories()`: para cada grupo marcado, itera `grupo.categorias` e renderiza um sub-bloco por categoria com seus chips de subcategoria.
- Quando `categoriaEhFolha(categoria)` (helper já existente em `src/lib/exerciseMapping.ts`), renderiza um único chip com o nome da categoria, gravando `{ categoria, subcategoria: categoria.subcategorias[0] }`.
- Montagem de `grupos: GroupSelection[]` (linha ~381) usa `categoria`/`subcategoria` do estado, eliminando a chamada a `resolverCategoria`.
- Preenchimento ao abrir em modo edição: lê `grupos` do exercício (`grupo`, `categoria`, `subcategoria`) direto para o novo formato; para registros legados sem `categoria`, usa `resolverCategoria` apenas como fallback.
- Checagem de "Articulações relacionadas" passa a comparar `sel.categoria` com "mobilidade articular".
- Sem migração de banco e sem alteração no formato do JSON `grupos` gravado.
