## Problema

O export do PDF de treino está cortando o **Bloco B do Treino 4** porque o orçamento de altura subestima a altura real das tabelas. Quando o conteúdo estoura, a rede de segurança `deletePage` apaga a página 2, removendo o Bloco B junto.

## Objetivo

1. Corrigir o cálculo de escala em `exportWorkoutPDF.ts` para que **todos os 4 treinos (Bloco A + Bloco B)** caibam completos em uma única página A4.
2. Adicionar um **teste de regressão automatizado** que falhe se algum treino for cortado, se o PDF tiver mais de uma página, ou se o layout produzir sobreposições.

## Mudanças no código

### 1. `src/components/student/workout/exportWorkoutPDF.ts` — orçamento de altura mais robusto

Refatorar o cálculo de `scale` para usar **dois passos**:

- **Estimativa otimista** (já existente) — assume que altura encolhe linearmente.
- **Estimativa por piso** (NOVA) — calcula altura mínima usando os pisos efetivos de `Math.max(piso, ...)` que o layout aplica quando `scale` é pequeno. Isso evita que o `scale` seja "alto demais" quando o conteúdo já bateu nos pisos.

```text
scale = max(0.22, min(1.6, optimisticScale, floorScale))
```

Também **abaixar os pisos mínimos** das fontes/paddings (`ROW_FONT 7.0 → 6.4`, `ROW_PAD 0.6 → 0.4`, etc.) para liberar mais espaço quando precisar comprimir treinos longos. A legibilidade fica preservada (6.4 pt ainda lê bem em A4).

Resultado: cenário típico (14 aquecimento + 4×5 força = 34 linhas) cabe folgado; cenários extremos comprimem ao limite mas nunca cortam.

### 2. `src/components/student/workout/exportWorkoutPDF.test.ts` — teste de regressão

Novo arquivo de teste Vitest cobrindo:

- **Página única**: `doc.getNumberOfPages() === 1` no cenário cheio (14 aquecimento + 4 treinos × 5 exercícios).
- **Treino 4 completo**: parsea o PDF (via `doc.output("arraybuffer")` + leitura de strings) e verifica que **todos os 5 nomes de exercício do Treino 4** aparecem (incluindo os 3 do Bloco B).
- **Sem sobreposições verticais**: instrumenta `autoTable` para coletar `lastAutoTable.finalY` após cada tabela e valida que cada `startY` da próxima tabela é `>=` ao `finalY` anterior.
- **Frequência presente**: verifica que o texto "FREQUÊNCIA" foi escrito no PDF.
- **Bolinhas vermelhas**: valida que o sentinel `"v"` legacy não está mais sendo escrito como texto (T1..T4 do aquecimento renderizam apenas círculos).

Como o `jspdf` precisa de canvas/DOM, o teste usa o ambiente `jsdom` já configurado em `vitest.config.ts`. O mock de `HTMLCanvasElement.prototype.getContext` retorna stubs no-op suficientes para o `jspdf` rodar headless.

### 3. Cobertura mínima do mock de canvas

Adicionar em `src/test/setup.ts` um polyfill leve de `HTMLCanvasElement.prototype.getContext` retornando um objeto com os métodos que o jspdf chama (vazios). Isso é necessário porque o `qrcode` (usado para o QR no header) tenta criar um canvas; alternativamente, o teste pode passar `qrUrl: undefined` para pular essa rota e simplificar.

## Critérios de aceite

- [ ] `bunx vitest run src/components/student/workout/exportWorkoutPDF.test.ts` passa.
- [ ] Cenário com 4 treinos × 5 exercícios + 14 aquecimentos gera PDF de **1 página**.
- [ ] Os 5 exercícios do Treino 4 aparecem no PDF.
- [ ] Nenhuma tabela começa antes do `finalY` da anterior (sem sobreposição).
- [ ] Build TypeScript continua passando.
