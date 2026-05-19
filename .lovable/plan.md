## Objetivo

Hoje os cards de **Corrida - Fase 1..4** abrem o `TemplateDetail` (mesmo das Fases), que só permite ajustar séries/reps/dias e trocar o exercício pelo Banco — sem adicionar/remover exercícios nem renomear. Vamos passar a abrir o **`PersonalizadoEditor`** (edição livre) para Corrida, pré-carregado com a estrutura atual do template.

## Comportamento

- Clicar em um card de Corrida abre o `PersonalizadoEditor` com:
  - **Se já existe** um modelo salvo em `banco_treinos_personalizados` com `nome = template.fase` (ex.: "Corrida - Fase 1"): abre no modo **edit** com o conteúdo salvo.
  - **Se não existe**: abre no modo **new**, pré-populado a partir do `WorkoutTemplate` (convertendo cada exercício em `PersonalizadoExercicioSimples` em "Bloco 1 (Principais)").
- Ao salvar, o `PersonalizadoEditor` grava em `banco_treinos_personalizados` como qualquer outro modelo personalizado — passa a aparecer também na seção "Meus Modelos" / "Modelos {autor}".
- Fases (Fase 1..4), Métodos (Planilha 5RM, 5-3-1, M102) e Personalizado/Personalizado 2 **continuam exatamente como estão**. Mudança escopada só a Corrida.

## Mudanças técnicas

Arquivo único: `src/pages/BancoTreinos.tsx`.

1. **Nova helper** `seedFromWorkoutTemplate(template: WorkoutTemplate): PersonalizadoConteudo`
   - `aquecimento`: `{ LIB: [], MOB: [], ATI: [], PREV: [] }` (Corrida não tem aquecimento; se um dia tiver, mapeia por `categoria`).
   - `treinos`: para cada `template.treinos[i]`, cria `{ nome, blocos: [{ nome: "Bloco 1 (Principais)", exercicios: [...simples] }] }`.
   - Cada exercício vira `{ tipo: "simples", categoria, exercicio, series, repeticoes }`.

2. **Estado** `personalizadoOpen` ganha nova variante:
   ```ts
   | { mode: "new"; variante: "corrida"; templateFase: string; seed: PersonalizadoConteudo }
   ```

3. **Click handler** do card (linhas 1121-1129):
   - Se `template.fase.startsWith("Corrida")`:
     - Procura em `modelosPersonalizados` um item com `nome === template.fase`.
     - Se achou → `setPersonalizadoOpen({ mode: "edit", id, nome, conteudo })`.
     - Senão → `setPersonalizadoOpen({ mode: "new", variante: "corrida", templateFase: template.fase, seed: seedFromWorkoutTemplate(template) })`.
   - Demais cards: mantém o `setSelected(template)` atual.

4. **Render do `PersonalizadoEditor`** (linhas 1046-1071): adiciona o terceiro caso para `variante === "corrida"` — usa `seed` como `initial` e `templateFase` como `initialName`.

5. Nenhuma alteração de banco, RLS, tipos ou outras telas. `WORKOUT_TEMPLATES` segue como seed read-only.

## Notas

- Não há migração de dados: a primeira edição cria o registro em `banco_treinos_personalizados`. Antes disso, o template original (`WORKOUT_TEMPLATES`) é a fonte da visualização inicial.
- A "Indicação da Fase Inicial" da aula experimental (que usa `WORKOUT_TEMPLATES`) **não muda** — continua prescrevendo a versão base do template; se quiser que ela leia o modelo editado, abre como nova issue separada.
