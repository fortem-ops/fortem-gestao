## Exercícios dinâmicos no PDF: linhas separadas + cor por semana

Hoje, ao exportar o PDF, um exercício **Dinâmico** (rotação Ímpar/Par ou Rotativa) é "achatado" em **uma única linha** com nomes concatenados (ex.: `I/P Agachamento / Stiff` e séries/reps `3/3` `10/12`). Isso dificulta a leitura e impede de associar visualmente cada variante a uma semana específica do bloco de Frequência.

### O que muda

1. **Cada variante vira uma linha própria** dentro do bloco de Força (Bloco A / Bloco B), em vez de uma única linha com `/`.
   - Mantém a mesma `categoria` (CAT) repetida, mas com a primeira linha "ancorando" o grupo.
   - A coluna `EXERCÍCIO` mostra o nome puro da variante (sem o prefixo `I/P` / `ROT`).
   - `SÉRIES`, `REP`, `KG` mostram os valores específicos daquela variante (modo `independente`) ou os valores compartilhados (modo `compartilhado`).

2. **Cor de fundo da linha = cor da semana correspondente**, seguindo a mesma lógica da coluna **Frequência** à direita:
   - `impar_par` (2 variantes): variante 1 = semanas ímpares (fundo **branco**), variante 2 = semanas pares (fundo **vermelho claro / RED_TINT**).
   - `rotativa` (N variantes): semana 1 → branco, semana 2 → vermelho, semana 3 → branco, semana 4 → vermelho, ciclando. A cor de cada linha segue o índice da variante: ímpar = branco, par = RED_TINT (mesmo `RED_TINT` já usado na coluna Frequência).

3. **Marcador visual de grupo dinâmico**: uma fina barra vertical vermelha (2px) à esquerda das linhas do grupo, agrupando visualmente as variantes do mesmo exercício dinâmico. Pequeno rótulo `I/P` ou `ROT` aparece como sufixo discreto na CAT da primeira linha do grupo (ex.: `DJS · I/P`).

### Como fica (ilustração ASCII)

Antes:
```text
CAT  EXERCÍCIO                             SÉRIES  REP    KG
DJS  I/P Agachamento / Stiff               3/3     10/12  —
```

Depois (Ímpar/Par, fundo das linhas espelha as semanas):
```text
CAT       EXERCÍCIO              SÉRIES  REP   KG
DJS·I/P   Agachamento            3       10    —     ← branco (semanas ímpares)
DJS       Stiff                  3       12    —     ← RED_TINT (semanas pares)
```

Depois (Rotativa com 4 variantes):
```text
DJS·ROT   Agachamento            3       10    —     ← branco (sem 1)
DJS       Afundo                 3       10    —     ← RED_TINT (sem 2)
DJS       Búlgaro                3       10    —     ← branco (sem 3)
DJS       Stiff                  3       10    —     ← RED_TINT (sem 4)
```

### Detalhes técnicos

- **`src/components/student/workout/personalizadoTypes.ts`** — `flattenPersonalizado`:
  - Para `tipo === "dinamico"`: emitir **N linhas** (uma por variante) em vez de uma só.
  - Adicionar campos extras opcionais em `WorkoutExercise` para o renderer:
    - `dinamicoIndex?: number` (0..N-1) — índice da variante.
    - `dinamicoTotal?: number` — N total de variantes.
    - `dinamicoTag?: "I/P" | "ROT"` — apenas na primeira linha do grupo.
  - Linha 1 do grupo recebe a `categoria` original; linhas seguintes podem repetir a categoria (cell já é "bold" cinza, fica natural).
  - `series`/`repeticoes`/`video_url` de cada linha vêm da própria variante (modo `independente`) ou são herdados do grupo (modo `compartilhado`).

- **`src/components/student/workout/workoutTemplates.ts`** — adicionar os 3 campos opcionais à `interface WorkoutExercise` (não-quebrante).

- **`src/components/student/workout/exportWorkoutPDF.ts`** — em `renderForcaBlock`:
  - No `didParseCell` (section `body`), pintar `cell.styles.fillColor`:
    - Se a row é parte de um grupo dinâmico (`dinamicoIndex !== undefined`): usar `WHITE` para índice par (0,2,4…) e `RED_TINT` para índice ímpar (1,3,5…). Isso casa com a coluna Frequência que alterna por semana (`week % 2 === 0` usa RED_TINT).
    - Sobrepõe o `alternateRowStyles` zebra atual para essas linhas.
  - No `didDrawCell` da primeira coluna (CAT) da primeira linha do grupo: desenhar uma barrinha vertical vermelha (`RED_SOFT`) de ~0.6mm de largura colando à borda esquerda da célula, estendendo a altura do grupo (calculada via `dinamicoTotal × cell.height`). Para simplificar e evitar coordenar alturas entre rows, desenhar a barra **em cada linha do grupo** (mesmo X, mesma largura), criando visualmente uma única barra contínua.
  - Concatenar tag na CAT: se `dinamicoTag` definido, exibir `categoria + " · " + tag` apenas na primeira linha (já vem montado no `flattenPersonalizado`, sem lógica adicional no renderer).

- **Frequência**: nenhum ajuste — a coluna lateral já usa exatamente o mesmo esquema (branco para semana ímpar, `RED_TINT` para semana par), garantindo coerência visual lado a lado.

- **Compatibilidade**: linhas sem `dinamicoIndex` continuam usando `alternateRowStyles` (zebra cinza) — comportamento atual preservado para exercícios SIMPLES.

### Arquivos editados

- `src/components/student/workout/workoutTemplates.ts`
- `src/components/student/workout/personalizadoTypes.ts`
- `src/components/student/workout/exportWorkoutPDF.ts`

### QA

Gerar PDFs e inspecionar:
1. Treino Personalizado com 1 exercício **Ímpar/Par** (2 variantes) → 2 linhas, 1ª branca, 2ª RED_TINT, barrinha vermelha à esquerda.
2. Treino Personalizado com 1 exercício **Rotativa** com 3 e 4 variantes → linhas alternando branco/RED_TINT.
3. Modo `independente` vs `compartilhado` → séries/reps por linha vs valores únicos.
4. Mistura de exercícios Simples + Dinâmicos no mesmo bloco → zebra cinza nos simples, alternância branco/vermelho apenas nos dinâmicos.
5. Tudo cabendo em página A4 única (validar `scale` two-pass — N maior de linhas pode forçar redução de fonte).