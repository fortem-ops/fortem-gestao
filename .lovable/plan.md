
# Método 5-3-1 (Wendler) — Prescrição por aluno

Substitui o stub estático de 5-3-1 no Banco de Treinos por um construtor real, por aluno, que grava na tabela `treinos` existente (mesmo mecanismo de status `rascunho`/`atual` já usado pelo Personalizado). Nenhum trigger novo, nenhuma tabela nova, nenhum disparo de WhatsApp.

## Estrutura de dados (JSONB em `treinos.conteudo`)

Novo tipo dedicado — **não** reaproveita `WorkoutExercise`. Arquivo: `src/lib/wendler531.ts`.

```ts
type Levantamento = "Agachamento" | "Terra" | "Supino" | "Remada Curvada" | "Press";

interface Acessorio531 {
  vinculado_a: Levantamento;      // um dos levantamentos principais do MESMO dia
  exercicio: string;
  // por semana (1..3). Semana 4 não tem acessório.
  semanas: Array<{
    semana: 1 | 2 | 3;
    series: number;
    reps: string;                 // texto livre (10, 8-10, AMRAP etc)
    percentual: number;           // % sobre TM do levantamento vinculado
  }>;
}

interface Auxiliar531 {
  exercicio: string;
  series: number;
  reps: string;
  kg?: string;                    // livre / opcional
}

interface DiaLevantamento531 {
  levantamento: Levantamento;
  rm_1: number;                   // 1RM digitado pelo prof (kg)
}

interface Dia531 {
  ordem: number;                  // 1..N
  levantamentos: DiaLevantamento531[];   // 1+ por dia
  acessorios: Acessorio531[];
  auxiliares: Auxiliar531[];
}

export interface Wendler531Conteudo {
  variante: "531";                 // discriminador
  frequencia: 2 | 3 | 4 | 5;
  percentual_training_max: number; // ex 90
  dias: Dia531[];
}
```

Helper puro no mesmo arquivo:
- `roundToNearest2_5(kg)` → `Math.round(kg / 2.5) * 2.5`
- `trainingMax(rm1, pctTM)`
- `WAVE`: tabela fixa das 4 semanas (aquecimento 40/50/60 5×5×5 + trabalho por semana com % e rótulos AMRAP `5+/3+/1+`, semana 4 deload)
- `computeWave(rm1, pctTM)` → `Array<{ semana: 1|2|3|4, series: Array<{ pct, reps, kg }> }>` já com kg arredondado e aquecimento sempre incluído.

## Fluxo do professor

1. Card **5-3-1** no Banco de Treinos abre um **selector de aluno** (dialog simples com busca em `alunos`).
2. Depois de escolhido o aluno, abre `Prescricao531Editor` em tela cheia (mesmo padrão do `PersonalizadoEditor`).
3. Passos internos do editor:
   - Frequência semanal (2/3/4/5) → gera N dias vazios.
   - % Training Max (input numérico, default 90).
   - Para cada dia: adicionar levantamentos principais (multi-select dos 5, sem restrição de layout). Press só aparece quando frequência = 5.
   - Cada levantamento adicionado tem input de **1RM**; abaixo aparece automaticamente a tabela de 4 semanas calculada (%, reps, kg), incluindo aquecimento.
   - Acessórios do dia: escolher levantamento vinculado + exercício + para semanas 1/2/3 (séries, reps, %). KG calculado no ato usando TM do vinculado.
   - Auxiliares do dia: exercício + séries + reps + kg livre. Iguais nas 4 semanas.
4. **Autosave** com debounce de 800ms em `treinos` (status `rascunho`) — cria a linha na primeira mudança relevante e depois faz `update`.
5. Botão **Concluir prescrição**: arquiva treino `atual` anterior do aluno (mesma lógica do `PersonalizadoEditor`) e promove o rascunho para `status = 'atual'`, `template_fase = '5-3-1'`, `semanas = 4`, `data_inicio = hoje`, incrementando `versao`.

## Arquivos alterados

### Novos
- `src/lib/wendler531.ts` — types + calc helpers puros.
- `src/components/student/workout/Prescricao531Editor.tsx` — construtor completo (autosave + concluir).
- `src/components/student/workout/Select531AlunoDialog.tsx` — seletor de aluno para iniciar a prescrição (busca simples reaproveitando query de `alunos`).

### Editados
- `src/pages/BancoTreinos.tsx`:
  - remove `"5-3-1"` de `isUnderConstruction`;
  - o card 5-3-1 continua na seção Métodos, mas passa a ser renderizado a partir de uma entrada sintética local (já que será removido de `WORKOUT_TEMPLATES`);
  - `onClick` no card 5-3-1 abre o `Select531AlunoDialog`; ao escolher aluno, monta a tela do `Prescricao531Editor`.
- `src/components/student/workout/workoutTemplates.ts`: remove a entrada estática `fase: "5-3-1"` (Treinos 1–4 com reps "5/3/1").
- `src/pages/PublicWorkout.tsx`: quando `template_fase === '5-3-1'`, renderiza layout dedicado (ver abaixo) usando os mesmos tokens/tipografia atuais; caso contrário mantém o render existente.
- `src/pages/portal/PortalWorkouts.tsx`: guarda de segurança — quando `template_fase === '5-3-1'` (ou `conteudo.variante === '531'`), renderiza uma versão simplificada por dia (levantamento → tabela de 4 semanas + acessórios + auxiliares), reusando os helpers de `wendler531.ts`. Sem editar cargas nem sessões (o mecanismo de `treino_sessoes`/`treino_cargas` não se aplica a 5-3-1 nesta primeira versão).

## Layout PublicWorkout (novo, dedicado)

Mesmo header/cores/tipografia atuais. Uma `<section>` por dia:

```text
TREINO 1 — Agachamento + Supino
┌────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Agachamento    │ Semana 1     │ Semana 2     │ Semana 3     │ Semana 4     │
│ TM 90kg        │ 5×40  5×50   │ 5×40  5×50   │ 5×40  5×50   │ 5×40  5×50   │
│                │ 5×60  5×65   │ 5×60  5×70   │ 5×60  5×75   │ 5×60  5×60   │
│                │ 5×75  5+×85  │ 5×80  3+×90  │ 3×85  1+×95  │ 5×60  5+×60  │
└────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
(mesmo bloco repetido lado a lado / abaixo para cada levantamento do dia)

ACESSÓRIOS
| Vinculado    | Exercício      | Sem | Séries×Reps | %   | Kg  |
| Agachamento  | Leg Press      | 1   | 4×10        | 60  | 54  |
| ...
(sem linhas para Semana 4)

AUXILIARES
| Exercício    | Séries×Reps | Kg     |
```

Tabelas são divs com grid do Tailwind (não `<table>`), respeitando responsividade mobile já usada em PublicWorkout.

## Persistência — tabela `treinos` (colunas já existentes)

Campos preenchidos: `aluno_id`, `autor_id`, `descricao` (ex.: "5-3-1 — Onda 4 semanas"), `conteudo` (`Wendler531Conteudo`), `status` (`rascunho` → `atual`), `versao`, `template_fase = '5-3-1'`, `semanas = 4`, `data_inicio` (na conclusão).

## Verificação

- `tsgo` sem erros novos.
- Abrir `/banco-treinos`, clicar 5-3-1, selecionar aluno teste, gerar prescrição, concluir; abrir `/treino/:id` público e ver o layout novo; abrir `/portal/treinos` como o aluno e confirmar que não quebra e mostra a versão simplificada.

## Fora do escopo (confirmado)

- Nada de WhatsApp.
- Nada de tabelas relacionais novas.
- Nada de alteração em Fases, Personalizado, Personalizado 2, Planilha 5RM, M102 ou Corrida.
- Sem sistema paralelo de status.
