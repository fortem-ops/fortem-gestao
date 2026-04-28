## Objetivo

No Banco de Treinos > [Fase] > Aquecimento, agrupar a listagem de cada bloco (LIB, MOB, ATI) pelas suas subcategorias (ex.: "Pé/Tornozelo", "Joelho/Coxa", "Quadril", "Torácica", "Glenoumeral", "Estabilidade Lombar PA", "Kettlebell", etc.), em vez de mostrar uma única lista plana.

## Como ficará

Estrutura visual dentro do card "Aquecimento":

```text
LIBERAÇÃO (LIB)
  ▸ Pé/Tornozelo
      [tabela de exercícios desta subcategoria]
  ▸ Joelho/Coxa
      [tabela ...]
  ▸ Quadril
      [tabela ...]
  ▸ Torácica
      [tabela ...]

MOBILIDADE (MOB)
  ▸ Quadril
      [tabela ...]
  ▸ Torácica
      [tabela ...]
  ...

ATIVAÇÃO (ATI)
  ▸ Estabilidade Lombar PA
      [tabela ...]
  ...
```

Cada subcategoria vira um sub‑agrupamento com seu próprio título e sua própria tabela de exercícios.

## Detalhes técnicos

Arquivo: `src/pages/BancoTreinos.tsx` — função `TemplateDetail` (bloco do "Aquecimento", linhas ~481‑515).

Mudanças:

1. Para cada bloco em `["LIB","MOB","ATI"]`:
   - Filtrar `template.aquecimento` pelo `categoria === block` (já feito hoje).
   - Agrupar os itens resultantes por `ex.subcategoria` (string vazia/undefined cai em um grupo "Geral").
   - Preservar a ordem de aparecimento das subcategorias conforme aparecem no template (usando `Map` para manter a ordem de inserção).

2. Renderização:
   - Manter o título atual do bloco: `LIBERAÇÃO (LIB)` etc., como cabeçalho do agrupamento principal.
   - Para cada subcategoria, renderizar:
     - Um sub‑título menor (ex.: `text-xs font-medium text-muted-foreground` com ícone/▸ ou apenas texto), com leve indentação (`pl-2` ou `ml-2`).
     - Um `<ExerciseTable>` recebendo apenas os exercícios daquela subcategoria, com as mesmas props já usadas (`bank`, `showDays`, `onOpenVideo`, `templateFase`, `treinoNome="__aquecimento__"`, `escolhasMap`, `onSaveChoice`, `onClearChoice`, `onSaveOverride`, `canEdit`).

3. Itens sem `subcategoria` (qualquer caso futuro) são agrupados sob um título "Geral" para não ficarem invisíveis.

4. Sem alterações em banco de dados, em `workoutTemplates.ts`, no PDF ou em outras telas — somente apresentação visual no Banco de Treinos.

## Fora de escopo

- Não altera a estrutura dos treinos de força (Bloco 1/Bloco 2).
- Não altera a exportação em PDF.
- Não altera permissões nem o fluxo de overrides — a edição inline continua funcionando dentro de cada subcategoria normalmente.