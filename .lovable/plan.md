## Ajustes no PDF de Treino — Bloco de Força

Três ajustes pontuais na renderização do bloco de força em `src/components/student/workout/exportWorkoutPDF.ts`.

### 1. Remover "..." ao final da CAT em exercícios dinâmicos

Hoje a primeira linha de um grupo dinâmico mostra `CAT · I/P` (ou `· ROT`). Como a coluna CAT tem só 9mm, o sufixo é cortado e vira reticências (`DJS…`). Solução: deixar de concatenar `dinamicoTag` na célula CAT — o agrupamento já é indicado pela barra vertical vermelha à esquerda. A célula CAT passa a exibir apenas `ex.categoria` (vazia nas linhas filhas, como já é hoje).

### 2. Quebra de bloco em preto (em vez de vermelho)

Na quebra de bloco (`blocoStart` em linha > 0):
- A borda superior reforçada passa de `RED` para `INK` (preto/zinc-900).
- O rótulo "BLOCO X" desenhado no canto superior esquerdo passa de `RED` para `INK`.

A barra vertical de agrupamento de dinâmico continua vermelha (sinaliza outro conceito).

### 3. Nova coluna "SEMANA" antes de SÉRIES

Adicionar uma coluna entre a coluna do nome do exercício e SÉRIES:

```text
CAT | EXERCÍCIO | SEMANA | SÉRIES | REP | KG
```

Conteúdo por linha:
- Exercício **simples**: célula vazia (vale para todas as semanas).
- Exercício **dinâmico**, variante de índice par (0, 2, 4… → linha branca, "primeira" da rotação): `1, 3, 5, 7`.
- Exercício **dinâmico**, variante de índice ímpar (1, 3… → linha vermelha): `2, 4, 6, 8`.

Para rotações com mais de 2 variantes (`rotativa`), seguimos a mesma lógica binária ímpar/par do `dinamicoIndex`, mantendo coerência com a coluna Frequência.

Estilo da nova coluna: fonte pequena (≈ `SMALL_FONT`), centralizada, cor `INK_SOFT`, em negrito leve. Largura ~22mm (espaço retirado proporcionalmente das colunas SÉRIES/REP/KG e do nome do exercício para preservar o layout A4).

### Detalhes técnicos

Arquivo único: `src/components/student/workout/exportWorkoutPDF.ts`, função `renderForcaBlock`.

- `head`: inserir `{ content: "SEMANA", styles: { halign: "center" } }` na posição 2.
- `body`: para cada linha, computar:
  ```ts
  const semanas = typeof ex.dinamicoIndex === "number"
    ? (ex.dinamicoIndex % 2 === 0 ? "1, 3, 5, 7" : "2, 4, 6, 8")
    : "";
  ```
  e inserir como 3ª célula.
- `columnStyles`: reindexar (CAT=0, EX=1, SEMANA=2, SÉRIES=3, REP=4, KG=5). Largura sugerida: `wCat=9, wSem=22, wSer=14, wRep=20, wKg=12`, e `wEx = mainW - soma`.
- `didDrawCell` da barra vertical do dinâmico: continua disparando em `column.index === 0`.
- `didParseCell` da quebra de bloco: trocar `RED` por `INK` em `lineColor`.
- `didDrawCell` do rótulo "BLOCO X": trocar `setTextColor(...RED)` por `setTextColor(...INK)`.
- Remover a concatenação `(ex.dinamicoTag ? \` · ${ex.dinamicoTag}\` : "")` do `catCell`.

Sem alterações em tipos, em `personalizadoTypes.ts` ou em templates — os campos `dinamicoIndex` e `dinamicoTotal` já existem e são suficientes.

### QA

Gerar PDF de um treino com exercícios simples + um dinâmico Ímpar/Par + um dinâmico Rotativa em blocos diferentes (Bloco A e Bloco B) e verificar:
- CAT do dinâmico mostra apenas a sigla, sem "..." nem "· I/P".
- Linha de quebra de Bloco B com borda superior preta e rótulo "BLOCO B" preto.
- Coluna SEMANA com "1, 3, 5, 7" nas linhas brancas dinâmicas e "2, 4, 6, 8" nas vermelhas; vazia nas simples.
- Largura das colunas ainda cabe em A4 sem ellipsizar nomes de exercícios comuns.
