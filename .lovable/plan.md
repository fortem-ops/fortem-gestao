## Ajustes no PDF de treino

Quatro mudanças no arquivo `src/components/student/workout/exportWorkoutPDF.ts`, mantendo o requisito de página única (Treino 4 completo, sem quebra).

### 1. Remover subtítulo do "Aquecimento"
Na chamada `sectionLabel("Aquecimento", "Liberação · Mobilidade · Ativação")`, remover o segundo argumento. Passa a ser apenas `sectionLabel("Aquecimento")`.

### 2. Título "AQUECIMENTO" como barra vermelha (igual aos treinos)
Refatorar o helper `sectionLabel` para desenhar uma barra vermelha de fundo cheio (mesmo estilo da barra "TREINO N"):

- Desenhar retângulo com `doc.setFillColor(...RED)` e altura igual a `BAR_H`, ocupando toda a largura `mainW`.
- Texto do título em **branco** (`WHITE`), bold, alinhado à esquerda com pequeno padding (`mainX + 2.2`), centralizado verticalmente na barra.
- Se houver `meta` (segundo argumento), desenhar também em branco à direita — mas neste caso será omitido (item 1).
- **Remover** a linha hairline cinza desenhada abaixo do título.
- Avançar `y += BAR_H + 0.45` (mesmo espaçamento usado após a barra dos treinos), em vez do `y += 1.1` × 2 atual.

### 3. Barras "TREINO 1–4": vermelho mantido + remover "FORÇA"
A barra dos treinos já é vermelha. A mudança é remover o rótulo "FORÇA" alinhado à direita dentro dessa barra (bloco que faz `doc.text("FORÇA", mainX + mainW - 1.8, ...)`).

### 4. Aumentar a fonte geral mantendo página única

Estratégia: subir os "pisos" (`Math.max(floor, nominal*scale)`) das fontes de conteúdo, e compensar o orçamento vertical para não estourar a página no Treino 4 com 5 exercícios.

Mudanças nas constantes (sem alterar a lógica de "two-pass scaling"):

- `EX_NAME_FONT`: piso `7.8 → 9.0`, nominal `12.5 → 13.5`
- `NUM_FONT` (séries/reps): piso `7.6 → 9.0`, nominal `12.0 → 13.5`
- `ROW_FONT` (linhas do aquecimento): piso `6.4 → 7.6`, nominal `9.5 → 11.0`
- `HEAD_FONT` (cabeçalhos de tabela): piso `5.4 → 6.2`, nominal `7.2 → 8.2`
- `SECTION_FONT` (texto "AQUECIMENTO" na barra vermelha): piso `6.0 → 7.0`, nominal `7.8 → 9.0`
- `TREINO_LABEL_FONT` (texto "TREINO N"): piso `5.4 → 6.6`, nominal `7.2 → 8.4`
- Manter os demais (META_FONT, BADGE_FONT, SMALL_FONT) — não impactam legibilidade dos exercícios.

Compensação no orçamento de altura (para garantir cabimento):

- `NOM_ROW`: `10.2 → 11.0` e `FLOOR_ROW`: `6.2 → 7.0`
- `BADGE_H` piso `2.4 → 2.8`
- `BAR_H` piso `3.6 → 4.2`
- Reduzir o ar entre seções para abrir espaço:
  - `sectionGap`: `0.8 → 0.6`
  - `treinoGap`: `0.6 → 0.4`
  - Espaço extra após renderizar bloco de força: `+ 0.8 → + 0.6`
  - Bloco de Observações: `OBS_LINE_GAP` `5 → 4.2`
- Aumentar o `slack` global em `floorEst` de `10 → 14`, garantindo que o pior caso (Treino 4 com 5 exercícios + nomes longos) ainda caiba.

### Validação
Rodar a suíte `src/components/student/workout/exportWorkoutPDF.test.ts` (já cobre):
- página única;
- Treino 4 com Bloco A + Bloco B totalmente renderizados;
- Frequência na página 1;
- variante "stress" com nomes extra-longos.

Se algum teste falhar, recalibrar o slack de `floorEst` para `16` e/ou reduzir 0.5pt em `EX_NAME_FONT` nominal, sempre re-executando até passarem todos.

### Arquivo afetado
- `src/components/student/workout/exportWorkoutPDF.ts`
