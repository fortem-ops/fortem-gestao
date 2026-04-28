# Plano — Categoria do Aquecimento = Subcategorias do bloco

## O que muda (visão do usuário)

Em **Banco de Treinos → Fase X → Aquecimento**, na tabela de cada bloco (Liberação, Mobilidade, Ativação), a coluna **Categoria** hoje mostra um menu com todos os códigos do sistema (LIB, MOB, ATI, PREV, COND, DJS, etc.).

Passará a mostrar **somente as subcategorias do bloco da linha**, conforme já cadastrado no Banco de Exercícios:

- **Liberação (LIB)** — 9 opções: Pé/Tornozelo, Perna, Joelho/Coxa, Quadril, Lombar, Torácica, Ombro/Escápula, Cervical, Cotovelo/Punho.
- **Mobilidade (MOB)** — 14 opções: Pé/Tornozelo, Joelho, Quadril, Quadril RE, Quadril RI, Flexibilidade Posterior MI, Flexibilidade Anterior MI, Torácica, Torácica Rotação, Glenoumeral, Glenoumeral RE, Glenoumeral RI, Cotovelo/Punho, Padrão Geral.
- **Ativação (ATI)** — 19 opções: Pé/Tornozelo, Perna, Estabilidade de Joelho, Quadril, Estabilidade Lombar PA, Estabilidade Lombar PP, Torácica, Ombro/Escápula, Cotovelo/Punho, Padrão Geral, Estabilidade Escapular, Desassociação Lombar/Quadril, Extensão Torácica, Kettlebell, Barra, LPO, Pliométrico, Coordenativo Corrida, Solo.

Ao escolher uma subcategoria, o seletor de **Exercício** ao lado passa a listar somente os exercícios daquele grupo+subcategoria (ex.: LIB · "Quadril" → só liberações de quadril cadastradas no Banco de Exercícios). Para **Coordenadores/Administradores** o select é editável; **Professores** veem em modo somente leitura (badge), igual à regra atual.

Os blocos de Treinos (Bloco 1/Bloco 2 das Fases) **não mudam** — continuam com o select de códigos atuais (DJS, DJA, PH, EH, ...).

## Como vai funcionar (técnico)

Arquivo único alterado: `src/pages/BancoTreinos.tsx`.

1. **Sinalizar contexto de aquecimento na linha**
   - Adicionar prop opcional `aquecimentoBloco?: "LIB" | "MOB" | "ATI"` em `ExerciseRow` e `ExerciseTable`.
   - No `TemplateDetail`, ao montar a `<ExerciseTable>` de cada bloco do Aquecimento (linhas ~497-509), passar `aquecimentoBloco={block}`. Para os blocos de Treinos, não passar nada.

2. **Trocar o conteúdo do select de Categoria** (linhas ~244-256)
   - Quando `aquecimentoBloco` está definido:
     - `value` = `escolha?.categoria_override ?? ex.subcategoria ?? ""` (placeholder "Selecione..." se vazio).
     - Opções vindas de `AQUECIMENTO_SUBCATEGORIAS[aquecimentoBloco]` (`src/lib/exerciseMapping.ts`).
     - `onChange` salva `categoria_override = nova subcategoria` (ou `null` se igual ao default do template).
   - Quando não definido (Treinos): mantém o comportamento atual (códigos de `CATEGORY_LABELS`).

3. **Filtrar exercícios pela subcategoria escolhida**
   - Estender `getCandidatesForCode` para aceitar um override de subcategoria, ex.: `getCandidatesForCode(categoria, bank, subOverride?)`.
   - Em `ExerciseRow`, calcular `effSubcategoria = escolha?.categoria_override ?? ex.subcategoria` quando `aquecimentoBloco` está definido, e passar para `ExercisePicker` (que já conhece `categoria`) via nova prop `subcategoriaOverride`.
   - `ExercisePicker` usa esse override no filtro: grupo = `CODE_TO_GRUPO[LIB|MOB|ATI]` (já mapeado) e subcategoria = override.

4. **Persistência**
   - Reutiliza a coluna existente `categoria_override` em `banco_treinos_escolhas` (já criada na migração anterior). Para aquecimento ela passa a guardar o **nome da subcategoria** (string), em vez de um código de categoria. Não há migração nova.
   - Limpeza: ao escolher a mesma subcategoria default do template (`ex.subcategoria`), grava `null` (mesma lógica atual).

5. **Permissões**
   - Mantém `canEdit`: editores veem `<select>`, professores veem `<Badge>` com a subcategoria efetiva.

## Fora do escopo

- Não altera schema do banco.
- Não altera Bloco 1/Bloco 2 dos Treinos.
- Não altera a tela de prescrição do aluno (`WorkoutDetail`) nem o PDF.
- Não altera o Editor "Personalizado".
