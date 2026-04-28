## Objetivo

No editor "Banco de Treinos > Método > Personalizado", ao prescrever exercícios de **Aquecimento** (LIB, MOB, ATI), o usuário deve primeiro escolher a **subcategoria** (ex: "Pé/Tornozelo", "Quadril", "Torácica"…) e só então selecionar o exercício correspondente — restringindo a busca aos exercícios cadastrados naquela subcategoria.

## Mudanças

### 1. Modelo de dados — `src/components/student/workout/personalizadoTypes.ts`
- Adicionar campo opcional `subcategoria?: string` em `PersonalizadoAquecimentoEx`.
- `flattenPersonalizado` permanece igual (subcategoria não vai para o PDF; é apenas auxílio de prescrição).

### 2. UI — `src/components/student/workout/PersonalizadoEditor.tsx` (bloco "Aquecimento", linhas ~599-672)
- Para cada item de aquecimento, antes do `ExerciseSelector`:
  - Renderizar um `<Select>` com a lista de subcategorias do bloco (LIB / MOB / ATI), reutilizando as listas já definidas em `StudentExerciseBank.tsx`.
  - Ao trocar a subcategoria, limpar `exercicio`, `exercicio_id` e `video_url` (evita inconsistência).
- Mover as listas de subcategorias para um helper compartilhado (ver item 3) para evitar duplicação.
- Layout: subcategoria + busca de exercício na mesma linha (subcategoria ~140px + selector flexível), mantendo Reps/Dias na linha de baixo.

### 3. Helper compartilhado — `src/lib/exerciseMapping.ts`
- Exportar `AQUECIMENTO_SUBCATEGORIAS: Record<"LIB"|"MOB"|"ATI", string[]>` com as listas atuais (copiadas de `StudentExerciseBank.tsx`).
- Manter `CODE_TO_GRUPO` / `CODE_TO_SUBCATEGORIA` inalterados.
- (Opcional, não obrigatório agora) refatorar `StudentExerciseBank` para consumir o helper — fora do escopo se aumentar risco.

### 4. ExerciseSelector — `src/components/student/workout/ExerciseSelector.tsx`
- Aceitar nova prop opcional `subcategoria?: string`.
- Quando fornecida, sobrescreve o `subAlvo` derivado de `CODE_TO_SUBCATEGORIA`, fazendo o filtro `ex.grupos.some(g => g.grupo === grupoAlvo && g.subcategoria === subcategoria)`.
- Placeholder e mensagem de "nenhum cadastrado" passam a citar a subcategoria escolhida.
- Comportamento atual (categorias de Força via `CODE_TO_SUBCATEGORIA`) permanece intacto — só é usado quando a prop está ausente.

### 5. Persistência
- Como `data.aquecimento` é salvo dentro de `conteudo` (jsonb) tanto em `banco_treinos_personalizados` quanto em `treinos.conteudo.estrutura`, o novo campo é persistido automaticamente — sem migração SQL.
- Auto-save (rascunho local + remoto) já cobre a nova propriedade.

## Comportamento esperado

1. Usuário clica "+ Exercício" no bloco LIB → aparece linha com:
   - Select "Subcategoria" (placeholder: "Escolha…", opções: Pé/Tornozelo, Perna, Joelho/Coxa, Quadril, Lombar, Torácica, Ombro/Escápula, Cervical, Cotovelo/Punho).
   - Campo de busca de exercício (desabilitado/placeholder "Selecione subcategoria primeiro" enquanto vazio).
2. Ao selecionar "Quadril", a busca passa a filtrar apenas exercícios cujo grupo = "Liberação Miofascial" **e** subcategoria = "Quadril".
3. Trocar a subcategoria limpa o exercício atual.
4. Reps e Dias seguem como hoje.
5. PDF e visualização do treino não mudam (subcategoria é apenas guia de prescrição).
