## Objetivo
Ajustar a venda de Plano em Recorrência: agrupar planos por nome com "a partir de", mostrar valor mensal (não o total do contrato) na etapa de Pagamento e cobrar apenas 1× o valor mensal no cartão, mantendo as 11 cobranças pendentes geradas pelo contrato.

## Mudanças

### 1) Etapa 2 — Plano (`VendaDialog.tsx`)
- Agrupar os planos filtrados pela frequência por **nome** (Start, Start+, Power, Pro, Max).
- Cada card mostra:
  - Nome do plano + cor.
  - Badge com as durações disponíveis (ex.: 3, 6, 12 meses).
  - À direita: **"a partir de R$ X,XX"** usando o menor `valor` entre as variantes.
- Ao clicar no card, abrir um seletor (chips ou Select) com as variantes de período daquele nome; o `planoId` real só é definido quando o período é escolhido.
- Botão "Continuar" só habilita após escolher o período.

### 2) Etapa 4 — Pagamento (`PagamentoStep.tsx` + `VendaDialog.tsx`)
- Quando `tipoCobranca === "recorrencia"`, o cabeçalho passa a exibir:
  - **Mensalidade**: `mensalEstimado` (valor que será cobrado agora e mensalmente).
  - Linha secundária: `Total do contrato: R$ X,XX (12×)` apenas como referência.
- Quando `tradicional`, mantém "Total a cobrar" com `subtotalPlano` como hoje.
- Propagar para o `PagarCartaoDialog` o valor mensal nesse fluxo (em vez de `valorFinal`/`subtotalPlano`).

### 3) `PagarCartaoDialog.tsx` — modo recorrência
- Adicionar prop opcional `recorrencia?: boolean` (e opcional `parcelasTotais?: number` p/ texto).
- Quando `recorrencia`:
  - Ocultar o seletor de **Parcelas** (forçar `installments = 1`).
  - Mostrar nota: *"Será cobrada a 1ª mensalidade de R$ X agora. As 11 demais ficam agendadas no contrato para cobrança automática."*
  - Manter `kind = "credit"` 1×; o valor enviado já é o mensal.
- Default (sem `recorrencia`) mantém comportamento atual (1–12×).

### 4) `VendaDialog.tsx` — cartão online em recorrência
- Ao chamar `PagarCartaoDialog`, passar `valor = mensalEstimado` e `recorrencia = true`.
- Após sucesso do pagamento, manter o gatilho atual de criação do contrato + 11 cobranças pendentes (já implementado na edge function `rede-cobrar-cartao`); confirmar que ela usa `valor_mensal` correto — caso receba o valor mensal como o total cobrado, garantir que a função grave `valor_mensal = valor cobrado`.

### Fora de escopo
- Não altera a lógica de cálculo (`vendas-calc.ts`), apenas qual número é exibido/passado adiante.
- Não mexe no fluxo Tradicional além do que está descrito.
