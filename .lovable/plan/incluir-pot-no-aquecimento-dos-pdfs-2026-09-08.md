# Incluir POT no aquecimento dos PDFs

Hoje os PDFs de treino imprimem apenas quatro grupos de aquecimento (LIB, MOB, ATI e PREV). Exercícios cadastrados em POT (Potência) existem na prescrição, mas somem na exportação.

## O que muda

- Todo grupo de aquecimento presente na prescrição aparece no PDF, incluindo POT.
- Ordem fixa de impressão: LIB, MOB, ATI, PREV, POT e, depois, qualquer outro grupo que venha a ser criado no Banco de Exercícios.
- Cada bloco mantém o mesmo visual dos atuais: selo com a sigla, título por extenso ("POTÊNCIA") e tabela com dias T1..T4.
- Vale para os quatro PDFs: treino padrão/fases, 5-3-1, M102 e Plan Strong 50.

## Detalhes técnicos

Arquivos:
- `src/components/student/workout/exportWorkoutPDF.ts` — a lista fixa `["LIB","MOB","ATI","PREV"]` aparece na estimativa de altura (auto-fit de página) e na montagem dos blocos; passa a ser derivada de `data.aquecimento` (valores distintos de `ex.categoria`) ordenada pela ordem preferencial. Adicionar entrada de cor para POT em `WARMUP_COLORS` com fallback para o padrão preto/branco quando a sigla for desconhecida.
- `src/components/student/workout/exportWendler531PDF.ts`, `exportM102PDF.ts`, `exportPlanStrongPDF.ts` — `aqBlocos` deixa de ser literal e passa a usar `Object.keys(aq)` filtrando blocos vazios, com a mesma ordenação. `AQ_LABELS` ganha `POT: "POTÊNCIA"` e fallback para a própria sigla.
- Rótulos: reutilizar as categorias do grupo "Aquecimento" já conhecidas (`CODE_TO_CATEGORIA` em `src/lib/exerciseMapping.ts`), sem alterar o mapeamento existente.
- Nenhuma mudança nos editores de prescrição, no portal do aluno ou na visualização pública.

## Validação

- `bunx tsgo --noEmit` e build.
- `bunx vitest run src/components/student/workout/exportWorkoutPDF.test.ts`.
- Gerar um PDF de treino com exercícios em POT e conferir visualmente (bloco presente, sem quebra indevida de página).
