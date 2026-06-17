## Objetivo
Na exportação/ impressão PDF de treinos, o subtítulo da ficha deve exibir o nome da **origem** (template/fase) em vez da descrição editada pelo professor.

- **Personalizado** → mostrar "PERSONALIZADO" no PDF  
- **Fases** (ex: "Fase 1", "Fase 2") → mostrar o nome da fase (comportamento atual, sem alteração visual)  
- **Compatibilidade**: treinos antigos sem origem registrada continuam usando a `descricao` (fallback).

## Como funciona hoje
A `descricao` do treino é editável pelo professor e é usada tanto na UI quanto no PDF. Não existe um campo separado que guarde o nome do template/fase de origem. Isso faz com que, se o professor renomear o treino para "SEBÁSTIAN - TREINO 3 DIAS", o PDF também saia com esse texto — inclusive quando o treino veio do template "Personalizado" ou "Fase 1".

## Implementação

### 1. Banco de dados — nova coluna `template_fase` em `treinos`
- Adicionar `template_fase TEXT` via migration em `public.treinos`.
- Incluir `GRANT` necessário para `authenticated`/`service_role`.

### 2. Preencher `template_fase` na criação do treino
Atualizar os 3 pontos de inserção na tabela `treinos`:

| Arquivo | Contexto | Valor de `template_fase` |
|---|---|---|
| `src/lib/workoutImport.ts` — `prescribeFaseInicial` | Importação do Banco de Treinos (Fases, Métodos, Corrida) | `faseNome` (ex: "Fase 1", "Personalizado") |
| `src/components/student/workout/WorkoutDetail.tsx` — `handleSave` | Criação a partir de template exibido no WorkoutDetail | `fase \|\| descricao` |
| `src/components/student/workout/PersonalizadoEditor.tsx` — `saveToAluno` | Prescrição via editor Personalizado | `"Personalizado"` |

Atualizações de treinos existentes (`update`) **não** tocam `template_fate`, preservando a origem original.

### 3. PDF — usar origem no subtítulo
- `exportWorkoutPDF` passa a aceitar um novo campo opcional `template_fase`.
- Lógica do subtítulo no cabeçalho do PDF:
  ```
  se template_fase estiver presente → usa template_fase.toUpperCase()
  senão → fallback para descricao.toUpperCase() (comportamento legado)
  ```
- Isso garante que, se o professor editar a descrição depois, o PDF ainda exiba o nome da origem.

### 4. UI — passar `template_fase` para o exportador
- `WorkoutDetail`: ler `treino?.template_fase` e repassar para `exportWorkoutPDF`.
- `PersonalizadoEditor`: repassar `"Personalizado"` (ou `treino?.template_fase` se já existir) para `exportWorkoutPDF`.

### 5. Tipos
- Atualizar interfaces `TreinoRow` (em `PublicWorkout.tsx`) e `WorkoutDetailProps` para incluir `template_fase?: string \| null`.

## Fora do escopo
- Alterar o subtítulo exibido na tela (apenas o PDF).
- Mudar como a `descricao` é renderizada na listagem de treinos do aluno.
- Migração de dados retroativos (treinos antigos continuam sem `template_fase` e usam fallback).

## Arquivos afetados
- `supabase/migrations/2026..._*.sql` (nova migration)
- `src/lib/workoutImport.ts`
- `src/components/student/workout/WorkoutDetail.tsx`
- `src/components/student/workout/PersonalizadoEditor.tsx`
- `src/components/student/workout/exportWorkoutPDF.ts`
- `src/pages/PublicWorkout.tsx` (tipos)