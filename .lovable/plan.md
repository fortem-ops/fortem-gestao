# Adicionar coluna SEMANA no PDF (Personalizado, exercícios DINÂMICOS)

## Objetivo
Quando um treino Personalizado contém um exercício DINÂMICO, o PDF exportado deve mostrar a coluna **SEMANA** (antes de SÉRIES) na seção de Força, indicando a qual semana cada variante se aplica.

## Comportamento

- A coluna **SEMANA** só é incluída na tabela de Força quando o treino tem ao menos um exercício dinâmico (`dinamicoIndex` definido em alguma linha).
- Para linhas de variantes dinâmicas:
  - **Rotação Ímpar/Par (`I/P`)**: a 1ª variante (index 0) → "ÍMPAR"; a 2ª variante (index 1) → "PAR".
  - **Rotação rotativa (`ROT`)**: cada variante recebe `SEM 1`, `SEM 2`, `SEM 3`... conforme `dinamicoIndex + 1`.
- Para linhas de exercícios simples (não dinâmicos): célula SEMANA fica vazia (—), mantendo o layout consistente.
- Se um treino não tem nenhum exercício dinâmico, a coluna SEMANA **não aparece** (mantém o layout atual de 5 colunas).

## Layout

A largura da coluna SEMANA será ~16mm, descontada da coluna EXERCÍCIO. Nova ordem das colunas de Força (quando aplicável):

```text
CAT | EXERCÍCIO | SEMANA | SÉRIES | REP | KG
```

A coluna manterá o estilo das demais colunas numéricas (bold, centralizada, fonte `NUM_FONT`, cor `RED_SOFT` para destacar a semana).

## Detalhes técnicos

Arquivo a editar: `src/components/student/workout/exportWorkoutPDF.ts`

1. Em `renderForcaBlock`, detectar `hasDynamic = items.some(ex => typeof ex.dinamicoIndex === "number")`.
2. Se `hasDynamic`:
   - Adicionar `{ content: "SEMANA", styles: { halign: "center" } }` ao `head` entre EXERCÍCIO e SÉRIES.
   - Para cada `ex` no `body`, calcular o rótulo da semana:
     - Não dinâmico → `""`.
     - Dinâmico com tag (1ª variante) ou linhas seguintes do mesmo grupo: precisamos saber a `tag` do grupo. Como `dinamicoTag` só vem na 1ª linha, propagar a tag percorrendo `items` (manter última `tag` vista enquanto `dinamicoIndex` aumenta; resetar quando `dinamicoIndex` voltar a 0 ou for `undefined`).
     - Tag `I/P` → index 0: "ÍMPAR"; index 1: "PAR".
     - Tag `ROT` → `SEM ${dinamicoIndex + 1}`.
   - Inserir o valor como nova célula entre EXERCÍCIO e SÉRIES.
3. Ajustar `columnStyles` condicionalmente: quando `hasDynamic`, recalcular larguras incluindo `wSem = 16`, e shiftar os índices das colunas SÉRIES/REP/KG para 3/4/5.
4. Atualizar `didParseCell` (lógica de fundo de linha dinâmica) para continuar funcionando com índices deslocados — a regra atual usa `ex.dinamicoIndex` (independente de coluna), portanto continua válida sem mudanças.

## Testes

Atualizar `src/components/student/workout/exportWorkoutPDF.test.ts` com um novo caso:
- Gerar um PDF com um treino contendo um exercício dinâmico ROT de 3 variantes.
- Verificar que o stream da página 1 contém "SEMANA", "SEM 1", "SEM 2", "SEM 3".
- Verificar que um PDF sem exercícios dinâmicos **não** contém "SEMANA" na seção de Força (apenas em Frequência, que é texto separado).

## Restrições mantidas

- Layout de 1 página A4 preservado (coluna nova é estreita e sai da largura de EXERCÍCIO).
- Regras de adicionar blocos / treinos / simples / dinâmico no Personalizado **não mudam**.
- Aquecimento e Frequência **não são alterados**.
