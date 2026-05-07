## Objetivo
Na coluna **FREQUÊNCIA** do PDF de treino, mostrar apenas as linhas de treino realmente prescritas:
- 2 treinos → T1, T2 por semana
- 3 treinos → T1, T2, T3 por semana
- 4 treinos → T1..T4 por semana (comportamento atual)

## Alteração em `src/components/student/workout/exportWorkoutPDF.ts`

Hoje a renderização da Frequência usa fixo 4 slots por semana:

```ts
const slotCount = safeWeeks * 4;
// ...
const tNum = (i % 4) + 1;
```

### Mudanças
1. Calcular o número de treinos ativos a partir dos dados:
   ```ts
   const activeT = Math.max(1, Math.min(4, data.treinos.length));
   const slotCount = safeWeeks * activeT;
   ```
2. Trocar o módulo fixo `4` por `activeT`:
   ```ts
   const week = Math.floor(i / activeT) + 1;
   const tNum = (i % activeT) + 1;
   ```
3. Manter inalterado: cabeçalho vermelho "FREQUÊNCIA", legenda de semanas, linhas alternadas (red tint a cada 2 semanas), traço de assinatura, fontes e cores.
4. Não alterar a tabela de Aquecimento — a marcação de T1..T4 lá continua refletindo o que está prescrito por exercício (pedido se restringe à coluna Frequência).

### Orçamento de página única
- A coluna ocupa a mesma largura/altura disponíveis (`slotsAvailH = freqBottomY - slotsTop`); o `slotH = slotsAvailH / slotCount` se ajusta automaticamente.
- Com menos slots por semana, cada slot fica maior (sem risco de overflow). Com 4 treinos, comportamento atual é preservado.

## QA
- Renderizar `exportWorkoutPDF` em três cenários (2, 3 e 4 treinos), converter para imagem com `pdftoppm` e verificar:
  - Coluna mostra exatamente T1..Tn por semana
  - "SEM N" continua aparecendo na primeira linha de cada semana
  - Tudo cabe em 1 página A4
- Rodar `exportWorkoutPDF.test.ts` (cenário com 4 treinos) — não deve regredir.

## Arquivo afetado
- `src/components/student/workout/exportWorkoutPDF.ts` (única edição)
