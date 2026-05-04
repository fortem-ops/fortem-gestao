## Objetivo

Permitir que Coordenadores e Administradores **criem, renomeiem e excluam** Grupos (categorias raiz) e Subcategorias usados no Banco de Exercícios — e que essas mudanças apareçam automaticamente em todas as telas que usam essa taxonomia (Banco de Exercícios, Banco de Treinos, Editor Personalizado, Seletor de Exercícios).

Hoje a taxonomia está **hardcoded** em dois lugares (`StudentExerciseBank.tsx` → `CATEGORIES` e `src/lib/exerciseMapping.ts` → `GRUPO_SUBCATEGORIAS`). Vamos movê-la para o banco e ler de lá.

## Modelo de dados

Nova tabela `exercicio_categorias` no Supabase:

| coluna          | tipo         | obs                                                         |
|-----------------|--------------|-------------------------------------------------------------|
| id              | uuid PK      | `gen_random_uuid()`                                         |
| grupo           | text NOT NULL| nome do grupo (ex.: "Força", "Cardio")                      |
| subcategoria    | text NOT NULL| nome da subcategoria (ex.: "Kettlebell")                    |
| ordem_grupo     | int          | para ordenar grupos                                         |
| ordem_sub       | int          | para ordenar subcategorias dentro do grupo                  |
| created_at/updated_at | timestamptz | padrão                                                |

- UNIQUE `(grupo, subcategoria)` para evitar duplicatas.
- RLS:
  - SELECT: qualquer authenticated.
  - INSERT/UPDATE/DELETE: apenas `is_coordinator_or_admin(auth.uid())`.
- **Seed**: migração popula a tabela com toda a taxonomia atual (os 6 grupos × suas subcategorias) e com `ordem_grupo`/`ordem_sub` refletindo a ordem hoje hardcoded — assim nada muda visualmente no primeiro carregamento.

Não é necessário alterar `exercicios_personalizados`: ele já guarda `grupos` como JSONB de `{grupo, subcategoria}` por nome, o que continua funcionando.

## Hook compartilhado

Novo arquivo `src/hooks/useExerciseCategories.ts`:

- React Query (`["exercicio-categorias"]`) que busca todas as linhas e devolve:
  - `categories: { name, subcategories: string[] }[]` — mesmo formato do `CATEGORIES` atual, ordenado por `ordem_grupo`/`ordem_sub`.
  - `grupoSubcategorias: Record<string, string[]>` — mesmo formato do `GRUPO_SUBCATEGORIAS`.
  - mutations: `addGrupo`, `renameGrupo`, `deleteGrupo`, `addSub`, `renameSub`, `deleteSub`, `reorderGrupos`, `reorderSubs`.
- Quando uma mutation termina, invalida a query e também `["exercicios-personalizados"]` (no caso de renomeação, abaixo).

Para **renomeações**: ao renomear um grupo/subcategoria, executar também um update em `exercicios_personalizados` percorrendo o JSONB `grupos` e substituindo o nome antigo pelo novo, para manter a integridade dos vínculos. Será feito via função RPC simples ou via duas chamadas no cliente (preferimos RPC `rename_exercicio_categoria(old_grupo, old_sub|null, new_grupo, new_sub|null)` em SQL, atômica).

Para **exclusão**: bloquear (com toast de erro) caso existam exercícios associados àquela subcategoria/grupo. A checagem é feita antes da mutation; se `count > 0`, mostra "Existem N exercícios usando esta categoria. Mova-os ou exclua-os antes."

## UI — Banco de Exercícios

Em `src/components/student/StudentExerciseBank.tsx`:

1. Substituir o `const CATEGORIES` por leitura do hook `useExerciseCategories()`.
2. Adicionar, **apenas para Coordenador/Admin**, um botão "Gerenciar categorias" no topo da tela (ao lado de "Novo exercício").
3. Esse botão abre um `Dialog` com duas abas/seções:
   - **Grupos**: lista os grupos com input para renomear, botão excluir (com confirmação) e setas de reordenar. Campo "Novo grupo" + botão "Adicionar".
   - **Subcategorias**: select de grupo no topo; abaixo, lista das subcategorias daquele grupo com renomear/excluir/reordenar e campo "Nova subcategoria" + "Adicionar".
4. Validações no cliente:
   - Nome obrigatório, 1–80 caracteres, não pode duplicar (case-insensitive) dentro do escopo (grupo, ou subcategoria dentro do grupo).
5. Após qualquer mutation, a UI da árvore de categorias atualiza automaticamente (já é reativa via React Query).

## UI — outros consumidores

- `src/lib/exerciseMapping.ts`: manter `CODE_TO_GRUPO` / `CODE_TO_SUBCATEGORIA` (são mapas de códigos de template → nomes); **remover** `GRUPO_SUBCATEGORIAS` e `AQUECIMENTO_SUBCATEGORIAS` (ou deixá-los como fallback inicial).
- `src/pages/BancoTreinos.tsx`, `src/components/student/workout/PersonalizadoEditor.tsx`, `src/components/student/workout/ExerciseSelector.tsx`: trocar import desses mapas pelo hook `useExerciseCategories()` (`grupoSubcategorias`). `AQUECIMENTO_SUBCATEGORIAS` passa a ser derivado: `LIB → grupoSubcategorias["Liberação Miofascial"]`, `MOB → ["Mobilidade Articular"]`, `ATI → ["Ativação Muscular"]`.

## Permissões

- Botão "Gerenciar categorias" e o Dialog inteiro só renderizam para `isCoordOrAdmin` (mesma checagem usada hoje para drag-and-drop e edição).
- Backend: RLS já garante que mesmo que alguém force a chamada, só coord/admin consegue gravar.

## Arquivos afetados

- **Migração nova** (cria tabela + RLS + seed + função `rename_exercicio_categoria`).
- `src/hooks/useExerciseCategories.ts` — novo.
- `src/components/student/StudentExerciseBank.tsx` — usar hook + adicionar Dialog "Gerenciar categorias".
- `src/lib/exerciseMapping.ts` — remover `GRUPO_SUBCATEGORIAS` e `AQUECIMENTO_SUBCATEGORIAS`.
- `src/pages/BancoTreinos.tsx`, `src/components/student/workout/PersonalizadoEditor.tsx`, `src/components/student/workout/ExerciseSelector.tsx` — passar a usar o hook.

## Pontos fora de escopo (confirmar)

- Não estamos criando "categorias raiz" diferentes de Grupo/Subcategoria (a hierarquia continua sendo de 2 níveis: Grupo → Subcategoria), pois é o que o resto do app entende. Se você quiser um terceiro nível, me avise.
- Não migramos exercícios para foreign-keys de categoria — mantemos por nome (mais simples e compatível com o JSONB existente). Renomeação faz update em massa para preservar vínculos.