## Mudanças em `src/pages/financeiro/Contratos.tsx` e `src/hooks/useContratos.ts`

### 1. Ordem cronológica crescente
- Ordenar a lista pela `proxima_cobranca` (ascendente), colocando contratos sem próxima cobrança no fim.
- Para contratos sem cobrança pendente, usar a `data_vencimento` da última cobrança paga como fallback de ordenação.

### 2. Coluna "Status" com Pago / Pendente
- Adicionar uma nova coluna **"Status pagamento"** ao lado da coluna atual de status do contrato.
- Para cada contrato, derivar o status da cobrança vigente:
  - **Pago** (verde): se a cobrança do mês atual já está marcada como `pago`.
  - **Pendente** (amarelo): existe cobrança pendente ainda não vencida.
  - **Vencida** (vermelho): existe cobrança pendente com `data_vencimento < hoje`.
  - **—**: sem cobranças.
- O hook `useTodosContratos` já traz `cobrancas(data_vencimento, status)`; estender o `select` para incluir também `data_pagamento` e calcular `status_pagamento` + `proxima_cobranca` no `.map`.

### 3. Novo filtro de período (sobre "Próxima cobrança")
Adicionar um 5º `Select` "Período" no card de Filtros com presets:

- **Todos** (default)
- **Passado** (próxima cobrança < hoje — vencidas)
- **Presente / Atual** (vencimento dentro do mês corrente)
- **Futuro** (vencimento > hoje)
- **Mês atual**
- **Mês passado**
- **Próximo mês**
- **Período entre…** — abre dois `DatePicker` (shadcn Popover + Calendar com `pointer-events-auto`) para `de` / `até`

A filtragem ocorre client-side no `useMemo` existente, comparando `c.proxima_cobranca` com a janela escolhida. Quando "Período entre…" está ativo, mostrar os dois date pickers logo abaixo da grid de filtros.

### Arquivos alterados
- `src/hooks/useContratos.ts` — estender `useTodosContratos` para derivar `status_pagamento` (pago/pendente/vencida) por contrato.
- `src/pages/financeiro/Contratos.tsx` — ordenação asc, nova coluna de status pagamento, filtro de período com presets + intervalo customizado.

Nenhuma alteração de schema, RLS ou edge function.