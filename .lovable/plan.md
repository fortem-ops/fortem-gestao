## Objetivo

Em `Alunos > Aluno (perfil) > Treinos`, adicionar um novo botão **"Importar de Aluno"** ao lado do já existente **"Importar do Banco de Treinos"**. Ao clicar, o profissional escolhe um aluno de origem, seleciona um dos treinos dele (atual ou arquivados), e o conteúdo é carregado no **editor Personalizado** (mesmas regras e layout de Banco de Treinos > Métodos > Personalizado) já preenchido, podendo editar livremente antes de salvar como novo treino "atual" do aluno destino.

## Fluxo de uso

1. Profissional abre o perfil do aluno destino → aba Treinos.
2. Clica em **"Importar de Aluno"** (novo botão, ao lado de "Importar do Banco de Treinos").
3. Dialog abre com:
   - Campo de busca de aluno (StudentPicker — permite escolher inclusive o próprio aluno).
   - Após selecionar, lista os treinos daquele aluno (descrição, versão, status, data) ordenados por mais recentes.
4. Profissional clica em um treino → o dialog troca para o **PersonalizadoEditor** já preenchido com o conteúdo copiado.
5. Edita à vontade (blocos, exercícios simples/dinâmicos, aquecimento — todas as regras existentes do Personalizado se mantêm).
6. Clica em **"Salvar no aluno"** → arquiva o treino "atual" do aluno destino e cria nova versão "atual" com o conteúdo editado (lógica já existente no PersonalizadoEditor via `saveToAluno`).

## Conversão do conteúdo de origem

O editor Personalizado opera sobre `PersonalizadoConteudo` (estrutura rica com blocos). Os treinos de origem podem estar em dois formatos:

- **Personalizado** (`__personalizado: true`): usar `conteudo.estrutura` direto como `initial`.
- **Formato plano legado** (templates de Fases/Métodos sem blocos): converter on-the-fly para `PersonalizadoConteudo`:
  - `aquecimento[]` plano → distribuído em `LIB/MOB/ATI` via `categoria` de cada item.
  - Cada `treino.exercicios[]` plano → vira um único `Bloco A` com exercícios do tipo `simples` (categoria, nome, séries, repetições, exercicio_id, video_url preservados).
  - Conteúdos sem shape reconhecido caem no fallback de bloco vazio.

A função de conversão fica em um novo helper em `personalizadoTypes.ts`: `personalizadoFromFlat(raw): PersonalizadoConteudo`.

## Mudanças técnicas

### 1. Novo helper — `src/components/student/workout/personalizadoTypes.ts`
Adicionar `personalizadoFromFlat(raw: unknown): PersonalizadoConteudo` que:
- Se `isPersonalizadoContent(raw)` → retorna `raw.estrutura`.
- Senão lê `raw.aquecimento` e `raw.treinos` no formato `WorkoutData` e remonta a estrutura rica (1 bloco "Bloco A" por treino, exercícios simples).

### 2. Novo componente — `src/components/student/workout/ImportFromStudentDialog.tsx`
- Props: `{ alunoId: string; onSaved?: () => void }`.
- Estado: `open`, `sourceAlunoId`, `selectedTreino`.
- Query 1: lista alunos via `StudentPicker` (já existe).
- Query 2 (habilitada quando `sourceAlunoId` definido): `treinos` daquele aluno (`select("*").eq("aluno_id", sourceAlunoId).order("created_at desc")`).
- Quando `selectedTreino` está setado: renderiza `<PersonalizadoEditor initial={personalizadoFromFlat(selectedTreino.conteudo)} initialName={\`Cópia de ${selectedTreino.descricao}\`} alunoId={alunoId} alunoNome={...} onBack={() => setSelectedTreino(null)} onSaved={() => { onSaved?.(); close(); }} />`.
- Importante: NÃO passa `treinoId` — assim o save vira INSERT como nova versão "atual" (lógica já existente no editor).
- UX: header com aluno destino + aluno origem + botão "Trocar treino" para voltar à lista.

### 3. Integração — `src/components/student/StudentWorkouts.tsx`
- Importar `ImportFromStudentDialog` (lazy, mesmo padrão do `ImportFromBankDialog`).
- No header da aba (linha 49–53), adicionar o novo trigger ao lado do existente:
  ```
  <ImportFromBankDialog ... />
  <ImportFromStudentDialog alunoId={student.id} onSaved={() => refetch()} />
  ```

## Diagrama do fluxo

```text
[Perfil Aluno > Treinos]
   ├─ [Importar do Banco de Treinos]  (existente)
   └─ [Importar de Aluno]              (NOVO)
         │
         ▼
   Dialog: escolher aluno origem (StudentPicker)
         │
         ▼
   Lista treinos do aluno origem (atual + arquivados)
         │ click em um treino
         ▼
   PersonalizadoEditor (initial = conteúdo convertido)
         │ edita livremente (regras Personalizado)
         ▼
   Salvar no aluno  →  arquiva atual + cria nova versão
```

## Considerações

- **Reuso máximo**: nada de novo editor — usa o `PersonalizadoEditor` existente, garantindo paridade total com Banco de Treinos > Métodos > Personalizado (abas de treinos, blocos, simples/dinâmico, aquecimento LIB/MOB/ATI).
- **RLS**: a tabela `treinos` já tem SELECT autenticado liberado e INSERT pelo `autor_id = auth.uid()` — sem mudanças no banco.
- **Sem migrations** necessárias.
- **Permissão de import do mesmo aluno**: explicitamente suportado (útil para versionar/duplicar treino atual).
- **Vídeos e exercicio_id**: preservados na conversão, pois copiamos os campos `exercicio_id` e `video_url` de cada exercício.
