## Problema

Subcategorias novas criadas pelo Coordenador no Banco de Exercícios não aparecem nos dropdowns de categoria do editor de prescrição (`PersonalizadoEditor` → bloco FORÇA), porque ele usa uma lista estática `FORCA_CATEGORIAS` de códigos hardcoded.

## Mudanças

### 1. `src/lib/exerciseMapping.ts`
- Adicionar `SUBCATEGORIA_TO_CODE` (inverso de `CODE_TO_SUBCATEGORIA`).
- Adicionar helper `categoriaToGrupoSub(value, categories)` que resolve o valor de `ex.categoria` (código curto OU nome de subcategoria) em `{ grupo, subcategoria }`, consultando primeiro os mapas de código e, em fallback, a taxonomia da tabela.

### 2. `src/components/student/workout/PersonalizadoEditor.tsx`
- Refatorar `CategoriaSelect`: em vez de listar `FORCA_CATEGORIAS`, ler `categories` de `useExerciseCategories()` e renderizar todas as subcategorias dos grupos de treino (qualquer grupo que NÃO seja Liberação/Mobilidade/Ativação/Preventivo), agrupadas por grupo via `SelectGroup`/`SelectLabel`.
- Valor salvo em `ex.categoria`: se a subcategoria tiver código conhecido (`SUBCATEGORIA_TO_CODE`), salvar o código (preserva templates atuais e badges); caso contrário, salvar o próprio nome.
- Padrões de Movimento: inicializar counters a partir de `Object.keys(CATEGORY_LABELS)` e adicionar dinamicamente qualquer `ex.categoria` que aparecer.

### 3. `src/components/student/workout/ExerciseSelector.tsx`
- Aceitar prop opcional `grupo?: string`.
- Resolver `grupoAlvo`/`subAlvo` via `categoriaToGrupoSub(categoria, categories)` quando os mapas de código não casarem; props `grupo`/`subcategoria` continuam tendo prioridade.
- Carregar `categories` via `useExerciseCategories()`.

## Compatibilidade
- Templates antigos (DJS, DQ_P, etc.) continuam funcionando — códigos resolvem pelos mapas atuais.
- Aquecimento já é dinâmico, sem mudanças.

## Arquivos
- `src/lib/exerciseMapping.ts`
- `src/components/student/workout/PersonalizadoEditor.tsx`
- `src/components/student/workout/ExerciseSelector.tsx`
