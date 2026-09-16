# Corrigir direção do Psoas no Comparativo (menor é melhor)

## Contexto
Na aba Resultados > Comparativo (tabela de comparação entre datas), toda métrica funcional assume "aumentar = verde". Para Flexibilidade Psoas isso está invertido: quanto mais próximo de 0°, melhor — um aumento deveria aparecer em vermelho.

O projeto já define o conceito de métricas invertidas (`METRICAS_INVERTIDAS = {"Flexibilidade Psoas"}` em `bodyMapLogic.ts`), mas o `ComparativoTab` não o usa.

## Mudanças

1. `src/components/student/assessment/funcionalV2/bodyMapLogic.ts`
   - Exportar `METRICAS_INVERTIDAS` (ou um helper `metricaInvertida(metric)`), sem alterar o conjunto nem comportamento existente.

2. `src/components/avaliacoes-premium/tabs/ComparativoTab.tsx` — em `funcRows`:
   - Para cada linha de métrica (E/D), definir `higherIsBetter: !metricaInvertida(metric)`.
   - Resultado: aumento no Psoas → Δ vermelho com seta para baixo invertida de tom (vermelho); diminuição → verde. Demais métricas seguem como estão (aumento = verde).

Força, composição e pliometria permanecem como estão (composição/pliometria já declaram `higherIsBetter` próprios).

## Verificação
- Typecheck (`bunx tsgo --noEmit`).
- Testes existentes de `aquecimentoSugestoes` (já cobrem Psoas invertido) continuam passando.
