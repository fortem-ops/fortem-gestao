## Contexto
O usuário deseja adicionar a informação de **Data de Início de Plano** (coluna "Início Plano") na tabela de **Alunos Ativos**, bem como a opção de filtrar por essa data nos **Filtros Avançados**.

## Arquivos envolvidos
- `src/pages/StudentList.tsx` — lista de alunos e renderização da tabela
- `src/components/student/StudentListFilters.tsx` — filtros avançados e tipos de filtro

## Mudanças

### 1. `src/pages/StudentList.tsx`
- No fetch de planos (`planos` query), já temos `data_inicio` selecionado. Precisamos guardar o valor em um novo mapa `planStartMap` (similar ao `planEndMap` e `planTipoMap`).
- Incluir `planStart` no objeto retornado para cada aluno no `useQuery`.
- Adicionar coluna "Início Plano" no `<thead>` (posição sugerida: após "Plano" ou antes de "Final Plano").
- Renderizar a data formatada (`dd/MM/yyyy`) na nova `<td>` da tabela, usando classe hidden para breakpoints (ex: `hidden lg:table-cell`).
- Ajustar `colSpan` da mensagem "Nenhum aluno encontrado" se necessário (de 10 para 11).

### 2. `src/components/student/StudentListFilters.tsx`
- Adicionar ao tipo `StudentFilters`:
  - `dataInicioDe: Date | undefined`
  - `dataInicioAte: Date | undefined`
- Atualizar `defaultFilters` com os novos campos.
- Adicionar dois seletores de data no painel de Filtros Avançados (estilo igual aos de "Data Final Plano"):
  - "Início Plano (de)"
  - "Início Plano (até)"
- Atualizar `activeCount` para contar os novos filtros.
- Exportar o tipo atualizado.

### 3. Filtro na lógica de `StudentList.tsx`
- No `useMemo` de `filtered`, adicionar lógica `matchDateStart` similar ao `matchDate` existente para `planStart`, respeitando `filters.dataInicioDe` e `filters.dataInicioAte`.
- Incluir dependências no array do `useMemo`.

## Notas
- Manter o estilo visual existente (glass-card, badges, calendário Popover).
- A data de início do plano já vem da tabela `planos` (campo `data_inicio`), portanto não há mudanças no banco.
