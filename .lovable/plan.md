## Problema

As categorias **Kettlebell, Pliometria, Isoinercial, Abdominais (Abdômen), Extensão Torácica, LPO** e **Auxiliares** existem hoje apenas como **subcategorias** do grupo "Força" no Banco de Exercícios (`GRUPO_SUBCATEGORIAS["Força"]`), mas **não possuem códigos de categoria**.

Por isso, no Banco de Treinos elas:
- Não aparecem no seletor de **Categoria** (código) das linhas de exercício (ex.: DJS, DQ, PH...);
- Só aparecem como subcategoria quando o usuário primeiro escolhe um código que mapeia para "Força" — e ainda assim como filtro secundário, nunca como uma categoria principal selecionável;
- Não aparecem no `PersonalizadoEditor` (que usa a constante `FORCA_CATEGORIAS` com 16 códigos fixos).

## Solução

Criar códigos de categoria novos para cada uma dessas subcategorias e propagar nos três pontos onde a lista de códigos é usada.

### 1. `src/lib/exerciseMapping.ts`

Adicionar entradas mapeando os novos códigos ao grupo "Força" e à subcategoria correspondente:

```ts
// CODE_TO_GRUPO
KB: "Força",      // Kettlebell
PLIO: "Força",    // Pliometria
ISO: "Força",     // Isoinercial
ABD: "Força",     // Abdominais
ET: "Força",      // Extensão Torácica
LPO: "Força",     // LPO
AUX: "Força",     // Auxiliares

// CODE_TO_SUBCATEGORIA
KB: "Kettlebell",
PLIO: "Pliometria",
ISO: "Isoinercial",
ABD: "Abdominais",
ET: "Extensão Torácica",
LPO: "LPO",
AUX: "Auxiliares",
```

### 2. `src/components/student/workout/workoutTemplates.ts`

Adicionar os rótulos em `CATEGORY_LABELS`:

```ts
KB: "Kettlebell",
PLIO: "Pliometria",
ISO: "Isoinercial",
ABD: "Abdominais",
ET: "Extensão Torácica",
LPO: "LPO",
AUX: "Auxiliares",
```

Com isso, o select de Categoria em `BancoTreinos.tsx` (que itera `Object.keys(CATEGORY_LABELS)`) passa a mostrar as 7 novas opções para **todos os modelos** (Fases, Métodos, Corrida).

### 3. `src/components/student/workout/PersonalizadoEditor.tsx`

Adicionar os mesmos códigos à constante `FORCA_CATEGORIAS` para que apareçam nos seletores e contadores do Personalizado e Personalizado 2.

```ts
const FORCA_CATEGORIAS = [
  "DJS","DJA","DQ","DQ_P","PH","PV","EH","EV","EP","EEF","EE",
  "AH","AF","AR","PREV","COND",
  "KB","PLIO","ISO","ABD","ET","LPO","AUX",
];
```

## Resultado esperado

- Os 7 códigos novos aparecem no select **Categoria** de cada linha em todos os modelos do Banco de Treinos (Fases 1–4, Personalizado, Personalizado 2, Planilha 5RM, 5-3-1, M102, Corrida).
- Ao selecionar, por exemplo, `KB`, o `ExercisePicker` filtra automaticamente os exercícios cadastrados no Banco de Exercícios em **Força → Kettlebell** (graças ao mapeamento em `CODE_TO_GRUPO` e `CODE_TO_SUBCATEGORIA`).
- O usuário ainda pode trocar a subcategoria via select secundário (lista completa de subcategorias de Força permanece disponível).
- Nada quebra nos templates existentes — apenas amplia o conjunto de códigos disponíveis.

## Observações

- Não é necessária migração no banco de dados — as subcategorias já existem cadastradas em `exercicios_personalizados.grupos`.
- Os códigos escolhidos (KB, PLIO, ISO, ABD, ET, LPO, AUX) são novos e não conflitam com os existentes.
