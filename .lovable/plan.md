## Objetivo

Tornar o template **Personalizado** (Banco de Treinos → Métodos → Personalizado) totalmente editável, com persistência tanto como **modelo reutilizável** no Banco quanto **aplicado a um aluno**, mantendo o PDF em uma única página A4.

---

## 1. Modelo de dados

### Nova tabela `banco_treinos_personalizados` (modelos reutilizáveis)
- `id uuid pk`
- `nome text` (ex.: "Personalizado — Hipertrofia 4x")
- `conteudo jsonb` (estrutura abaixo)
- `criado_por uuid`, `created_at`, `updated_at`
- RLS: SELECT autenticados; INSERT/UPDATE/DELETE para autor ou coord/admin.

### Estrutura do `conteudo` (mesmo shape para modelo e treino do aluno)

```json
{
  "aquecimento": {
    "LIB": [{ "exercicio_id": "...", "nome": "...", "repeticoes": "60s", "dias": ["T1","T2"] }],
    "MOB": [...],
    "ATI": [...]
  },
  "treinos": [
    {
      "nome": "Treino 1",
      "blocos": [
        {
          "nome": "Bloco A",
          "exercicios": [
            {
              "tipo": "simples",
              "categoria": "DJS",
              "exercicio_id": "...", "nome": "Agachamento",
              "series": 3, "repeticoes": "10"
            },
            {
              "tipo": "dinamico",
              "categoria": "EH",
              "variantes": [
                { "exercicio_id": "...", "nome": "Supino" },
                { "exercicio_id": "...", "nome": "Apoio" }
              ],
              "rotacao": "impar_par",          // ou "rotativa"
              "series_modo": "compartilhado",  // ou "independente"
              "series": 3, "repeticoes": "10",
              "variantes_meta": [              // usado se "independente"
                { "series": 3, "repeticoes": "10" },
                { "series": 4, "repeticoes": "8" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "observacoes": ""
}
```

A estrutura é **retrocompatível** com o `WorkoutData` atual: ao salvar como `treinos.conteudo` para o aluno, é serializada nesse mesmo formato (o leitor antigo só precisa entender `blocos[].exercicios[]`; vamos migrar `WorkoutDetail` para o novo shape — abaixo).

---

## 2. Editor: `PersonalizadoEditor` (novo componente)

Arquivo novo: `src/components/student/workout/PersonalizadoEditor.tsx`.

### Cabeçalho
- Nome do modelo / descrição.
- Botões: **Salvar como modelo** (no Banco), **Aplicar a um aluno** (abre `StudentPicker` → salva em `treinos`), **Exportar PDF**, **Imprimir**.
- Quando aberto a partir de um aluno (rota com `alunoId`), aparece também **Salvar no aluno**.

### Aquecimento
- Três colunas/sessões: **LIB**, **MOB**, **ATI**.
- Cada uma tem seu próprio `+ Exercício` (quantidades independentes).
- Cada linha: seletor (`ExerciseSelector` filtrado pelo grupo correspondente), **Repetições** editável, chips de **Dias (T1–T4...)**.
- Botão remover por linha; reordenação via setas ↑/↓.

### Força
- Botão **+ Treino** (Treino 1, 2, 3, ... sem limite). Cada treino editável.
- Dentro de cada treino:
  - Botão **+ Bloco** (Bloco A, B, C, ...).
  - Dentro de cada bloco: **+ Exercício**.
- Cada linha de exercício tem um **toggle "Tipo"** (RadioGroup pequeno, com **escolha prévia obrigatória** antes de adicionar/converter):
  - **Simples** — 1 seletor de exercício, séries e reps editáveis.
  - **Dinâmico** — abre sub-controles:
    - **Sub-modo** (escolha prévia): `Ímpar/Par (X/Y)` · `X/Y independente (séries/reps por variante)` · `Rotação N variantes (semana 1=A, 2=B, 3=C…)`.
    - Conforme sub-modo, mostra 2 ou N seletores; séries/reps ou compartilhados ou por variante.
- Categoria do exercício (DJS, EH, etc.) selecionável por linha (Select com `CATEGORY_LABELS`) — usado para filtrar o seletor.
- Reordenar/remover blocos e exercícios.

### Observações
- Textarea livre, salva em `conteudo.observacoes`.

### Frequência
- Mesmo controle existente (1–12 semanas) usado pelo PDF.

---

## 3. Integração no Banco de Treinos

Em `src/pages/BancoTreinos.tsx`:

- Card **Personalizado** passa a abrir o `PersonalizadoEditor` em vez do `TemplateDetail` somente leitura.
- Acima do editor, lista de **Modelos personalizados salvos** (query da nova tabela). Cada item: abrir / duplicar / aplicar a aluno / excluir (se autor ou coord/admin).
- Permissão de prescrição: **todos os usuários autenticados** (professores/coord/admin) podem criar e editar seus próprios modelos; somente coord/admin podem editar modelos de outros.

Em `WorkoutDetail.tsx` (ficha do aluno):
- Quando o `treino.conteudo` tiver `blocos` (novo shape), renderiza usando o mesmo `PersonalizadoEditor` em modo "aluno". Templates antigos (sem `blocos`) continuam usando o renderer atual — converter ao salvar.

---

## 4. Exportação PDF (`exportWorkoutPDF.ts`)

Permanece em **uma única página** A4 retrato, sem quebra. Ajustes:

- Suportar **N treinos** e **N blocos** por treino (não mais hard-coded "Bloco A/B"). Loop dinâmico sobre `conteudo.treinos[].blocos[]`.
- Renderização de exercício:
  - **Simples** → linha única atual.
  - **Dinâmico (impar_par ou rotativa)** → **uma linha** com `Variante1 / Variante2 [/ Variante3...]` no campo "Exercício", e tag pequena à esquerda: `ÍMPAR/PAR` ou `1·2·3` indicando rotação.
  - **Dinâmico independente** → mesma linha, mas séries/reps mostrados como `3×10 / 4×8`.
- Two-pass scaling existente já reduz fontes para caber. Aumentar `slack` de `floorEst` adaptativamente em função do total de linhas (mais linhas → mais slack para tabela). Se ultrapassar o piso mínimo de fonte, reduzir `freqColW` até 18mm e/ou cortar `OBS_LINE_GAP`.
- Aquecimento: blocos LIB/MOB/ATI com contagens variáveis (já é o caso, mantém).
- Cabeçalho/Frequência/Observações inalterados.

Atualizar `exportWorkoutPDF.test.ts` com 2 cenários novos:
- Modelo personalizado denso (4 treinos × 3 blocos × 4 exercícios, com 30% dinâmicos) → 1 página, sem clipping.
- Modelo mínimo (1 treino, 1 bloco, 1 exercício) → 1 página.

---

## 5. Migrações e RLS

```sql
create table public.banco_treinos_personalizados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  conteudo jsonb not null default '{}'::jsonb,
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.banco_treinos_personalizados enable row level security;

create policy "view personalizados" on public.banco_treinos_personalizados
  for select to authenticated using (true);
create policy "insert personalizados" on public.banco_treinos_personalizados
  for insert to authenticated with check (auth.uid() = criado_por);
create policy "update personalizados" on public.banco_treinos_personalizados
  for update to authenticated using (auth.uid() = criado_por or is_coordinator_or_admin(auth.uid()));
create policy "delete personalizados" on public.banco_treinos_personalizados
  for delete to authenticated using (auth.uid() = criado_por or is_coordinator_or_admin(auth.uid()));
```

Trigger `update_updated_at_column` já existe.

---

## 6. Arquivos afetados

- **Novos**: `src/components/student/workout/PersonalizadoEditor.tsx`
- **Editados**:
  - `src/pages/BancoTreinos.tsx` (lista + roteamento para o novo editor)
  - `src/components/student/workout/WorkoutDetail.tsx` (detectar shape novo)
  - `src/components/student/workout/exportWorkoutPDF.ts` (loop dinâmico de blocos + render dinâmico)
  - `src/components/student/workout/exportWorkoutPDF.test.ts` (novos cenários)
  - `src/components/student/workout/workoutTemplates.ts` (tipos auxiliares opcionais)
- **Migração SQL**: nova tabela + RLS.

---

## 7. Validação

1. Criar modelo personalizado com aquecimento variado (LIB:2, MOB:5, ATI:3), 3 treinos com 2/3/2 blocos e mistura simples/dinâmico.
2. Salvar como modelo → aparece na listagem.
3. Aplicar a um aluno via `StudentPicker` → vira `treinos.conteudo` na ficha.
4. Exportar PDF (1 e 4 semanas) — deve caber em 1 página em ambos.
5. Reabrir via aluno e via Banco → editor preserva tudo.
6. Testes vitest passam (incluindo os 2 novos cenários).
