# Aquecimento dinâmico e Força voltando a apontar para Parte Principal

## O problema

Depois da reorganização do Banco de Exercícios, a taxonomia ficou assim:

```text
Aquecimento     > Liberação Miofascial / Mobilidade Articular / Ativação Muscular / Preventivo / Potência > subcategorias
Parte Principal > Força / Potência / Cardio / Coordenativo Corrida > subcategorias
```

A prescrição ainda foi escrita para o mundo antigo:

1. Os blocos de aquecimento são fixos no código (LIB, MOB, ATI, PREV). A categoria "Potência" criada dentro de Aquecimento não aparece na prescrição.
2. Os códigos de força (DJS, DQ, PH, KB, LPO...) procuram um **grupo** chamado "Força", que não existe mais — "Força" é hoje uma categoria dentro de "Parte Principal". Quando o nome da subcategoria existe nos dois lados (Kettlebell, Extensão Torácica, Estabilidade Escapular, LPO existem em Aquecimento e em Parte Principal), a busca casa com o lado errado e traz exercícios de aquecimento.

## O que será feito

### 1. Blocos de aquecimento dinâmicos

- Os blocos da seção AQUECIMENTO de todos os métodos (Fases, 5-3-1, M102, Plan Strong, Personalizado) passam a ser lidos das categorias do grupo **Aquecimento** do Banco de Exercícios, na ordem definida lá.
- Criar uma nova categoria dentro de Aquecimento faz o bloco aparecer automaticamente em todas as prescrições, com as mesmas regras dos blocos atuais (seleção de subcategoria, busca de exercício, séries/repetições, dias T1-T4, PDF e portal do aluno).
- Cada categoria de Aquecimento ganha um campo **Sigla** editável em "Gerenciar Categorias" (sugestão automática a partir do nome, ex.: Potência → POT). As categorias atuais recebem as siglas já usadas: LIB, MOB, ATI, PREV.
- Prescrições já salvas continuam válidas: as chaves LIB/MOB/ATI/PREV seguem sendo reconhecidas.
- Se a sigla de uma categoria for alterada depois, as prescrições antigas continuam sendo lidas pela sigla anterior (ela vira apelido).

### 2. Subcategorias corretas em cada bloco

O select de subcategoria de cada bloco (LIB, MOB, ATI, PREV, POT...) volta a listar as subcategorias daquela categoria dentro do grupo Aquecimento — Pé/Tornozelo, Perna, Quadril etc. — e a busca de exercícios fica restrita a elas.

### 3. FORÇA = Parte Principal

Os códigos de força passam a resolver para **Parte Principal > Força > subcategoria**, e os demais (COND → Cardio, LPO/Potência) para as categorias correspondentes de Parte Principal. Assim, "Kettlebell", "LPO", "Extensão Torácica" e "Estabilidade Escapular" na linha de força trazem os exercícios da Parte Principal, e não os homônimos do Aquecimento.

Nada é alterado nos exercícios cadastrados nem nas prescrições já salvas.

## Detalhes técnicos

- Banco: adicionar coluna `sigla text` em `exercicio_categorias` (por grupo+categoria), backfill LIB/MOB/ATI/PREV nas categorias de Aquecimento e sugestão automática para as demais; nova RPC `fn_definir_sigla_categoria(p_grupo, p_categoria, p_sigla)` `SECURITY DEFINER`, `search_path = public`, restrita a coordenador/admin, com unicidade da sigla dentro do grupo.
- `src/hooks/useExerciseCategories.ts`: expor `sigla` na árvore, mutation `definirSigla`, e helper `blocosAquecimento` (lista ordenada `{ sigla, categoria, subcategorias }` do grupo "Aquecimento").
- `src/lib/exerciseMapping.ts`: `resolverAlvo` ganha resolução por escopo — `resolverAlvo(value, tree, { grupoPreferido })`. Blocos de aquecimento resolvem com `grupoPreferido: "Aquecimento"`; códigos de força passam a mapear para `{ grupo: "Parte Principal", categoria: "Força" | "Cardio" | "Potência", subcategoria }`, com `acharSub` filtrando por categoria antes de grupo. `CODE_TO_GRUPO`/`CODE_TO_CATEGORIA` são reescritos nesse formato, mantendo fallback para dados legados.
- `src/components/student/workout/personalizadoTypes.ts`: `AquecimentoBloco` deixa de ser union fixa e vira `string`; `aquecimento` vira `Record<string, ...>` com as chaves legadas preservadas na normalização.
- `Prescricao531Editor.tsx`, `PrescricaoM102Editor.tsx`, `PrescricaoPlanStrongEditor.tsx`, `PersonalizadoEditor.tsx` e `src/pages/BancoTreinos.tsx`: substituem as listas fixas `AQUECIMENTO_BLOCOS`/`aquecimentoGrupoMap`/`const blocks = ["LIB","MOB","ATI"]` pelos blocos vindos do hook; o filtro de categorias de força passa a excluir categorias do grupo Aquecimento em vez de grupos.
- Leitura/exportação (`WorkoutDetail.tsx`, `PublicWorkout.tsx`, `PortalWorkouts.tsx`, `exportWorkoutPDF.ts`, `exportWendler531PDF.ts`, `exportM102PDF.ts`, `exportPlanStrongPDF.ts`): rótulos de bloco vêm da sigla/nome da categoria, com fallback para os rótulos atuais.
- `src/components/student/ManageCategoriesDialog.tsx`: campo Sigla na aba de categorias (somente coordenador/admin).
- Testes: casos novos em `src/test/exerciseMapping.test.ts` para resolução escopada (Kettlebell/LPO em Força vs Aquecimento) e para blocos derivados da árvore; suíte completa ao final.
