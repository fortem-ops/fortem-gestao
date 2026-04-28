## Objetivo

Em **Banco de Treinos > Métodos > Personalizado**, recriar o layout da seção **FORÇA** copiando o estilo de prescrição usado nas **Fases (1–4)**: tabela densa com colunas `# | Cat. | Exercício | Séries | Reps` por bloco, e exibir **Treino 1, Treino 2, Treino 3, Treino 4 lado a lado** em colunas (uma coluna por treino). Manter intactas todas as regras de adição/remoção de blocos, treinos, exercícios simples/dinâmicos.

## Referência visual (Fases)

Cada Fase usa um `<Card>` com `<Table>` shadcn e header de bloco em uppercase muted (`Bloco 1 (Principais)` / `Bloco 2 (Acessórios)`), colunas: `# | Categoria | Exercício | Séries | Reps`. Cada exercício é uma linha enxuta.

## Mudanças no `PersonalizadoEditor.tsx`

### 1. Substituir o container "FORÇA" por um grid horizontal de Treinos
- Atualmente os `data.treinos` são renderizados verticalmente (um abaixo do outro).
- Novo layout: um `<div>` com `grid` responsivo cuja contagem de colunas acompanha o nº de treinos:
  - 1 treino → 1 coluna
  - 2 treinos → `md:grid-cols-2`
  - 3 treinos → `lg:grid-cols-3`
  - 4+ treinos → `xl:grid-cols-4` (com scroll horizontal se necessário em telas menores via `overflow-x-auto` + `min-w` por coluna)
- Cabeçalho FORÇA continua com botão **+ Treino** à direita (regra mantida).

### 2. Cada coluna = 1 Treino (ex: "Treino 1")
Estrutura por coluna:
- Header da coluna: `Input` do nome do treino + botões **+ Bloco** e **Remover treino** (ícones compactos, mantém regras existentes).
- Para cada **Bloco** dentro do treino:
  - Sub-header tipo Fases: `Input` do nome do bloco (ex: "Bloco A") em estilo `text-sm font-semibold text-muted-foreground uppercase tracking-wide`, com **+ Exercício** (abre o `NewExerciseButton` atual com escolha simples/dinâmico — regra preservada) e botão remover bloco.
  - Tabela shadcn `<Table>` com colunas: `# | Cat. | Exercício | Séries | Reps | (×)` — densa e enxuta como em Fases.
  - **Linha de exercício SIMPLES**: uma única `<TableRow>` com:
    - Ordem do exercício no bloco
    - `CategoriaSelect` compacto (existente)
    - `ExerciseSelector` (existente) — sem label extra
    - `Input` séries (w-14)
    - `Input` reps (w-20)
    - Botão remover (ícone)
  - **Linha de exercício DINÂMICO**: 1 linha "mãe" + N linhas filhas (uma por variante), agrupadas visualmente:
    - Linha mãe: badge `DINÂMICO` + selects `Rotação` e `Séries/Reps modo` em uma `<TableRow>` com `colSpan` ocupando toda a largura (compacto).
    - Se modo `compartilhado`: inputs Séries/Reps na linha mãe.
    - Linhas filhas (uma por variante): badge com label `Ímpar (X)` / `Par (Y)` ou `Semana N`, `ExerciseSelector`, e (se modo `independente`) inputs Séries/Reps.
    - Botão **+ Variante** quando rotação = rotativa, como hoje.
    - Botão remover variante respeita o mínimo de 2 (regra mantida).

### 3. Preservar regras existentes (sem alteração de comportamento)
- `addTreino`, `removeTreino`, `updateTreinoNome`
- `addBloco`, `removeBloco`, `updateBlocoNome`
- `addExercicio` (com diálogo de tipo simples/dinâmico via `NewExerciseButton`)
- `removeExercicio`, `updateExercicio`
- Estrutura de dados `PersonalizadoConteudo` permanece idêntica.
- Auto-save, salvar modelo, aplicar a aluno, exportar PDF — inalterados.
- Aquecimento (LIB/MOB/ATI) e Observações — inalterados.

### 4. Refator interno de componentes
- Criar componente local `TreinoColumn` que recebe `(treino, ti)` e renderiza header + lista de blocos.
- Criar componente local `BlocoTable` que recebe `(bloco, ti, bi)` e renderiza a tabela de exercícios.
- Reutilizar `ExercicioRow` existente, mas adaptá-lo para ser uma `<TableRow>` (renomear/derivar para `ExercicioTableRow`) com células nas colunas certas. O `SimplesEditor` e `DinamicoEditor` atuais serão simplificados/inlined dentro da estrutura de tabela.

### 5. Estilo
- Usar mesmas classes que as Fases: `<Table>`, `TableHeader`, `TableHead w-12 / w-24 / w-20 text-center / w-24 text-center`.
- Wrapper de cada bloco: `rounded-lg border border-border overflow-hidden`.
- Coluna do Treino: `glass-card rounded-lg p-3 space-y-3` (consistência visual com o resto do app), `min-w-[420px]` para garantir leitura quando lado-a-lado em 4 colunas.

## Fora de escopo
- Mudar a forma como o PDF é gerado.
- Mudar a estrutura/persistência dos dados.
- Mudar Aquecimento ou Observações.
- Mudar o layout das Fases.

## Arquivos afetados
- `src/components/student/workout/PersonalizadoEditor.tsx` (única edição)
