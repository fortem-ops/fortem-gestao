## Objetivo
Ajustar a exportação do PDF de treino (`src/components/student/workout/exportWorkoutPDF.ts`) para:
1. Incluir o bloco **PREV (Preventivos)** na seção Aquecimento, com o mesmo padrão visual de LIB / MOB / ATI.
2. Adicionar **traços verticais** entre as colunas T1, T2, T3 e T4 no Aquecimento, para facilitar a leitura dos pontos de marcação.
3. Garantir que tudo continue cabendo em **uma única página A4**, sem quebra.

## Alterações em `src/components/student/workout/exportWorkoutPDF.ts`

### 1. Suporte a PREV
- Adicionar `PREV` ao mapa `WARMUP_COLORS` (mesma cor preta/branca dos demais para manter coerência da paleta).
- Incluir `{ key: "PREV", label: "PREVENTIVOS", items: [] }` no array `blocos` da seção Aquecimento.
- Atualizar `aqBlocosCount` para considerar `PREV` no cálculo do orçamento de altura (`["LIB", "MOB", "ATI", "PREV"]`).
- A entrada de dados já existe: `personalizadoTypes.ts` já trata `PREV` como `AquecimentoBloco` e o `flattenPersonalizado` já emite linhas com `categoria: "PREV"`.

### 2. Traços verticais entre T1–T4
- No `autoTable` do Aquecimento, ajustar `didDrawCell` (ou `didParseCell`) das colunas índice 3 a 6 (T1..T4) para desenhar uma linha vertical fina à direita de cada célula T1, T2 e T3 (separando das próximas), tanto no `head` quanto no `body`.
- Usar `doc.setDrawColor(...RULE)` com `lineWidth ~ 0.15` para um traço discreto, alinhado ao estilo minimalista atual.
- Opcionalmente desenhar também à esquerda da T1 e à direita da T4 para emoldurar o grupo, decisão visual a confirmar na renderização — manter sutil.

### 3. Orçamento de página única
- Ajustar as constantes `aqEst` e `floorEst` para usar o novo total de blocos de aquecimento (até 4), garantindo que o `scale` continue reduzindo proporcionalmente para caber em A4.
- Não alterar a lógica geral; apenas garantir que `aqBlocosCount` reflita os 4 blocos quando houver PREV.

## QA
- Renderizar via `exportWorkoutPDF` um treino com exercícios em LIB, MOB, ATI **e** PREV e converter para imagem (`pdftoppm`) para inspeção visual:
  - PREV aparece com badge e tabela idênticos aos demais blocos.
  - Linhas verticais visíveis e discretas entre T1, T2, T3, T4.
  - Conteúdo todo em 1 página, sem corte.
- Rodar o teste existente `exportWorkoutPDF.test.ts` para garantir não-regressão.

## Arquivos afetados
- `src/components/student/workout/exportWorkoutPDF.ts` (única edição funcional)
