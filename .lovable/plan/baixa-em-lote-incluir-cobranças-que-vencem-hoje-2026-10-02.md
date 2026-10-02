# Baixa em lote: incluir cobranças que vencem hoje

## O que muda

Hoje, na tela Financeiro > Contratos, a baixa em lote (seleção por checkbox + "Dar baixa em lote") só oferece cobranças com status **Vencida** (vencimento anterior a hoje). Cobranças **pendentes que vencem hoje** não podem ser selecionadas.

A mudança amplia o conjunto selecionável para incluir também cobranças pendentes **com vencimento até hoje** (vencimento = hoje inclusive). Cobranças com vencimento futuro continuam sem checkbox.

## Como

Em `src/pages/financeiro/Contratos.tsx`:

1. Renomear o recorte `vencidasVisiveis` para algo como `baixaveisVisiveis`, filtrando:
   - `status_pagamento === 'vencida'`, **ou**
   - `status_pagamento === 'pendente'` com `data_vencimento <= hoje` (comparação por data, sem hora).
2. O checkbox por linha passa a aparecer quando a cobrança está nesse conjunto (hoje: só quando `isInad`). O destaque visual vermelho da linha (`bg-destructive/5`) continua só para vencidas — cobrança vencendo hoje fica selecionável, mas sem o destaque de atraso.
3. Ajustar textos: `aria-label` do checkbox do cabeçalho ("Selecionar todas as cobranças vencidas" → "Selecionar todas as cobranças com vencimento até hoje") e o título do diálogo "Dar baixa em lote (retroativa)" → "Dar baixa em lote", já que agora não é só retroativa.

Nada muda na mutation `useDarBaixaLote` nem na lógica de baixa individual — elas já aceitam qualquer cobrança pendente.

## Verificação

- Rodar o type-check (`tsgo --noEmit`).
- Conferir o log de build.
