# Tooltips de Justificativa nos Cards Premium

Adicionar um balão suspenso (hover) em cada um dos 7 cards do `DashboardSummary` (Índice Fortem, Mobilidade, Força, Flexibilidade, Composição, Simetria, Risco de Lesão) explicando **por que** aquele valor foi atribuído.

## Como funciona hoje

- `DashboardSummary.tsx` renderiza 7 `DashboardScoreCard`.
- Os valores vêm de `computePremiumScores()` em `scoringPremium.ts`, que usa: métricas funcionais, força (assimetrias), % gordura (Pollock), e contagem de assimetrias severas/moderadas/cadeias.
- Hoje os cards mostram só número + banda (Bom/Atenção/Risco), sem explicação.

## Mudanças

### 1. `scoringPremium.ts` — expor justificativas
Estender `PremiumScores` com um campo:

```ts
justificativas: {
  indiceFortem: string;
  mobilidade: string;
  flexibilidade: string;
  forca: string;
  composicao: string;
  assimetria: string;
  risco: string;
}
```

Gerar cada string dentro de `computePremiumScores()` reaproveitando os dados já calculados. Exemplos do conteúdo:

- **Índice Fortem**: "Média ponderada de mobilidade (25%), força (25%), flexibilidade (20%), composição (15%) e risco (15%). Componentes considerados: X de 5."
- **Mobilidade**: "Calculado a partir de N métricas de mobilidade funcional. Score médio das regiões avaliadas."
- **Flexibilidade**: "Média de N testes de flexibilidade (Excelente=100, Bom=85, Médio=70, Regular=50, Fraco=25)."
- **Força**: "Calculado sobre N exercícios bilaterais. Penaliza assimetrias > 10% e déficits abaixo da referência por peso corporal."
- **Composição**: "% gordura = X% (sexo M/F) → faixa Pollock: [classificação]."
- **Simetria**: "N assimetrias detectadas (X severas, Y moderadas). 100 = perfeitamente simétrico."
- **Risco**: "Combina assimetrias severas (-25 cada), moderadas (-10 cada) e cadeias compensatórias (-8 cada). Detectadas: X severas, Y moderadas, Z cadeias."

Quando o valor é `null`, justificativa = "Sem dados suficientes para cálculo. Realize uma avaliação funcional/composição."

### 2. `DashboardScoreCard.tsx` — aceitar e mostrar tooltip
- Adicionar prop opcional `tooltip?: string`.
- Envolver o card em `<TooltipProvider><Tooltip><TooltipTrigger asChild>...</TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip></TooltipProvider>` usando `@/components/ui/tooltip`.
- TooltipContent com `max-w-xs` e texto `text-xs leading-relaxed`, estilo coerente com a `.bio-card` (fundo escuro semi-translúcido, borda sutil).
- Pequeno ícone `Info` (lucide) no canto superior direito do card como dica visual de que há tooltip.

### 3. `DashboardSummary.tsx` — passar a justificativa
Para cada `DashboardScoreCard`, passar `tooltip={scores.justificativas.<chave>}`.

## Fora de escopo

- Não alterar o cálculo dos scores.
- Não mexer nos demais componentes (BodyMap, Tabs).
- Sem nova migração de banco.
