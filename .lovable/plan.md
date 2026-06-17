## Objetivo

Ao importar um treino a partir de uma Fase ou Corrida-Fase no perfil do aluno, o professor deve poder ajustar **todas as variáveis** dos exercícios — não apenas trocar o exercício e mexer em repetições, como hoje.

Mudanças concentradas em **`src/components/student/workout/WorkoutDetail.tsx`** (a tela que abre depois de "Importar do Banco de Treinos"). Nenhum impacto em banco, RLS ou em treinos Personalizados (que já usam o `PersonalizadoEditor`).

## O que muda na UI

### 1. Aquecimento (LIB / MOB / ATI / PREV)
- Renderizar também o bloco **PREV** (Preventivo) — hoje só aparecem LIB/MOB/ATI; PREV existe no modelo de dados mas é ignorado na tela de edição.
- Tornar **Séries** editável (nova coluna ao lado de Rep.).
- Manter **Rep.** editável (já é).
- **Subcategoria** (ex.: "Quadril", "Torácica") vira input editável — atualmente é fixa.
- Botão **× remover** por linha.
- Botão **+ Adicionar exercício** ao fim de cada bloco (cria linha já com `categoria` = chave do bloco, `dias` = `["T1","T2","T3","T4"]`, demais campos vazios).
- Coluna **Dias** vira um seletor multi-toggle (T1, T2, T3, T4) em vez de texto somente-leitura.

### 2. Treinos / Força (Bloco A e Bloco B)
- Remover o limite rígido de 5 exercícios. Bloco A continua sendo os 2 primeiros; Bloco B passa a ser "do 3º em diante" (sem teto).
- Tornar **Séries** editável (input numérico curto). Hoje é só leitura.
- **Categoria** (DJS, PH, EV, AH, etc.) vira input curto editável em vez de badge fixa, para o professor poder ajustar.
- Manter **Rep.** e **KG** editáveis (já são).
- Botão **× remover** por linha.
- Botão **+ Adicionar exercício** ao fim de cada bloco (A insere na posição 2, B no fim; novo item entra com `series: 3`, `repeticoes: ""`, `categoria: ""`, `exercicio: ""`).

### 3. Mexer no estado
Estender `updateExercise` para aceitar campos numéricos (`series`) e arrays (`dias`, `subcategoria`). Adicionar dois helpers:
- `addExercise(section, treinoIdx, bloco)` — empurra um item novo no array correto.
- `removeExercise(section, treinoIdx, exIdx)` — remove pelo índice (com confirmação leve via `toast`).

Tudo continua salvando pelo fluxo atual de `handleSave` → `treinos.conteudo` (JSON). O `exportWorkoutPDF` e o `PublicWorkout` já leem o array dinamicamente, então passam a refletir as edições sem mudança extra.

## Fora de escopo
- Personalizado (já tem editor próprio com todas essas capacidades).
- Mudanças em RLS, migrations ou nos templates base em `workoutTemplates.ts`.
- Alteração da estrutura do PDF.