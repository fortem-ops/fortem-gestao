## Objetivo

Criar um novo modelo **"Personalizado 2"** dentro do grupo **Métodos** em `Banco de Treinos`. Ele reaproveita a interface tradicional das **Fases** (Aquecimento + 4 Treinos com tabelas), mas cada linha de exercício pode ser configurada como **Simples** (1 exercício) ou **Dinâmico** (variantes I/P ou Rotação), reproduzindo as regras já existentes no editor "Personalizado".

## O que muda na UI

Em `Métodos`, ao lado dos cards atuais (Personalizado, Planilha 5RM, 5-3-1, M102), aparece um novo card **"Personalizado 2"** com a mesma aparência das Fases. Ao abrir:

- Aquecimento vazio com os blocos LIB / MOB / ATI prontos para o professor adicionar exercícios.
- 4 Treinos (Treino 1..4) em abas, cada um com **Bloco 1 (Principais)** e **Bloco 2 (Acessórios)**, idênticos visualmente a Fase 1.
- Em cada linha do treino, um **seletor de tipo** (Simples / Dinâmico):
  - **Simples**: igual ao comportamento atual das Fases — escolhe categoria, exercício do banco, séries e repetições.
  - **Dinâmico**: abre subpainel com:
    - Rotação: **Ímpar/Par** ou **Rotativa (N variantes)**.
    - Modo de séries: **Compartilhado** (mesmas séries/reps para todas) ou **Independente** (por variante).
    - Lista de variantes (cada uma com exercício do banco + séries/reps quando independente).
- Ações por linha: adicionar / remover linha, escolher Demo (preview de vídeo), limpar escolha.
- Botões no topo: **Salvar como modelo** e **Voltar**.

Modelos salvos aparecem em **"Meus modelos"** abaixo dos cards (já existe a seção), e ao reabrir voltam à mesma tela.

## Detalhes técnicos

### 1. Template
Em `src/components/student/workout/workoutTemplates.ts`, adicionar entrada:
```
{ fase: "Personalizado 2", frequencia: "—", aquecimento: [], treinos: [Treino 1..4 vazios] }
```
E incluir `"Personalizado 2"` no filtro de Métodos em `PHASE_GROUPS` (`src/pages/BancoTreinos.tsx`).

### 2. Persistência
Reutilizar `banco_treinos_personalizados` (já existe, com `conteudo jsonb`). O conteúdo segue o shape `PersonalizadoTreinoConteudo` existente, com um marcador adicional `variante: "personalizado2"` para distinguir do "Personalizado" clássico ao listar/abrir.

### 3. Novo editor `Personalizado2Editor`
Novo arquivo `src/components/student/workout/Personalizado2Editor.tsx`, baseado no layout de `PhaseDetail` (Aquecimento + Tabs de Treinos + Blocos 1/2), porém:
- Usa estado local em memória do tipo `PersonalizadoConteudo` (mesmos tipos de `personalizadoTypes.ts`, sem alterar o shape).
- A `ExerciseTable` ganha uma variante "editável-rica" que renderiza, por linha:
  - Toggle Simples/Dinâmico.
  - Quando Dinâmico, expande área com select de Rotação, modo de séries e lista de variantes (reutiliza `ExercisePicker` existente para escolher cada variante).
- Ao salvar: chama `flattenPersonalizado(...)` e grava em `banco_treinos_personalizados` com `{ __personalizado: true, variante: "personalizado2", estrutura, aquecimento, treinos }`.

### 4. Roteamento na página
Em `BancoTreinos.tsx`, no clique do card:
- Se `template.fase === "Personalizado"` → abre `PersonalizadoEditor` (atual).
- Se `template.fase === "Personalizado 2"` → abre `Personalizado2Editor` (novo).
- Demais Fases/Métodos → fluxo `PhaseDetail` atual.

A listagem de "Meus modelos" passa a mostrar um chip indicando a variante (`Personalizado` ou `Personalizado 2`) e abre o editor correto.

### 5. Compatibilidade
- Não muda esquema do banco (apenas conteúdo do JSONB).
- Não altera `PersonalizadoEditor` atual nem `personalizadoTypes.ts` (apenas leitura/reuso).
- PDF/renderer continuam funcionando porque o `flatten` produz o mesmo formato plano (`aquecimento` + `treinos`).

## Arquivos afetados

- `src/components/student/workout/workoutTemplates.ts` — adicionar template "Personalizado 2".
- `src/components/student/workout/Personalizado2Editor.tsx` — novo editor.
- `src/pages/BancoTreinos.tsx` — incluir no filtro Métodos, abrir editor correto, ler `variante` na lista de modelos.
