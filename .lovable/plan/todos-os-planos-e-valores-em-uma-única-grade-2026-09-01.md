# Todos os planos e valores em uma única grade

Hoje a página /planos é um funil de 3 etapas: primeiro a frequência (2x/3x), depois o tipo de horário (livre/ocioso) e só então o resumo. O visitante nunca vê os quatro valores ao mesmo tempo.

## O que muda

- Uma seção única "Planos e valores" mostra as quatro opções lado a lado:
  - PLANO 2X — R$ 479 (horário livre)
  - PLANO 2X · HORÁRIO OCIOSO — R$ 419 (das 9:00 às 16:00)
  - PLANO 3X — R$ 599 (horário livre)
  - PLANO 3X · HORÁRIO OCIOSO — R$ 499 (das 9:00 às 16:00)
- Cada card traz nome, valor mensal, faixa de horário e a mesma lista de benefícios, com destaque no 3x horário livre.
- Grade responsiva: 4 colunas no desktop, 2 em tablet, 1 no celular.
- Ao escolher um card, o resumo aparece logo abaixo (mesma tela, com rolagem suave) com o botão de WhatsApp já existente.
- Somem a etapa de frequência, a barra de progresso e o botão "Voltar" — não há mais passos.
- Hero, prova social e rodapé continuam iguais.

## Detalhes técnicos

- Novo `src/components/planos/PlanosGrid.tsx`: percorre `FREQUENCIAS × PLANOS` de `planosPricing.ts` e renderiza os quatro cards usando `nomePlano` e `precoDe`.
- `src/pages/Planos.tsx`: estado passa a ser uma única seleção `{ frequencia, plano } | null`; remove `step`, `ProgressBar` e `StepFrequency`/`StepPlans` do fluxo; mantém `StepSummary` renderizado abaixo da grade quando há seleção. JSON-LD de SEO permanece com as quatro ofertas.
- `StepFrequency.tsx`, `StepPlans.tsx` e `ProgressBar.tsx` deixam de ser usados na rota e são removidos.
- Sem alterações de banco, edge functions ou preços — segue 100% frontend.
