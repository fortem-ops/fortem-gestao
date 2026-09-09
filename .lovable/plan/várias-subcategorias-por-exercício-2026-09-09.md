# Várias subcategorias por exercício

Hoje, ao criar ou editar um exercício, cada grupo marcado (Aquecimento, Parte Principal) aceita apenas uma subcategoria: clicar em outra troca a anterior. A proposta é permitir marcar quantas subcategorias forem necessárias, inclusive de categorias diferentes dentro do mesmo grupo.

## O que muda na tela

- Os botões de subcategoria passam a funcionar como marcadores: clicar marca, clicar de novo desmarca. Várias podem ficar marcadas ao mesmo tempo.
- Vale para categorias diferentes do mesmo grupo (ex.: em Aquecimento, marcar "Quadril" de Mobilidade Articular e "Perna" de Liberação Miofascial).
- Ao abrir um exercício já cadastrado, todas as subcategorias salvas aparecem marcadas.
- Um pequeno contador por grupo mostra quantas subcategorias estão marcadas.
- Salvar exige pelo menos uma subcategoria marcada (regra atual mantida).
- A caixa "Articulações relacionadas" continua aparecendo quando qualquer marcação for de Mobilidade Articular ou Liberação Miofascial, e continua obrigatória em Mobilidade Articular.
- O exercício passa a aparecer em todas as subcategorias marcadas, tanto na navegação do banco quanto na busca de exercícios ao montar treinos.

Nada muda no banco de dados nem nos exercícios já cadastrados: o formato salvo já é uma lista.

## Detalhes técnicos

Arquivo: `src/components/student/StudentExerciseBank.tsx`.

- `selecoes: Record<string, SelecaoGrupo>` passa a `Record<string, SelecaoGrupo[]>` (grupo → lista de `{ categoria, subcategoria }`).
- `openEditDialog`: acumula em array por grupo em vez de sobrescrever (`sel[g.grupo] = [...(sel[g.grupo] ?? []), {...}]`).
- `toggleGrupo`: inicializa `[]` ao marcar o grupo.
- Chips (linhas ~959-986): `active` = existe item com mesma categoria+subcategoria; `onClick` alterna adicionando/removendo esse item da lista do grupo.
- `handleSave` (linha ~394): `flatMap` das listas para montar `GroupSelection[]`; `isMobilidadeArticular` e o gate de `categoriaAceitaVinculo` passam a percorrer os arrays achatados.
- Validação: mantém `min(1)` do `exerciseSchema`, com mensagem ajustada para "Selecione pelo menos uma subcategoria".
- Sem alteração de schema, RPC ou RLS. Sem mudanças em `ExerciseSelector`/`exerciseMapping` — já filtram por `grupos.some(...)`.
