## Mudanças em `src/pages/AgendaTreinos.tsx`

### 1. Diálogo "Novo horário" com multi-seleção de dias
- Substituir o `Select` de "Dia da semana" por um grupo de 7 chips toggle (Dom–Sáb) com múltipla seleção.
- Manter os demais campos iguais (horário início/fim, capacidade, instrutor, observações).
- Ao salvar (modo criação): fazer um `insert` em lote com um registro por dia selecionado, todos compartilhando os mesmos horários/capacidade/instrutor/observações.
- Ao editar um slot existente: manter comportamento atual (um único dia, sem multi-seleção) — a edição continua alterando apenas aquele registro.
- Validação: pelo menos 1 dia selecionado e `horario_fim > horario_inicio`.
- Toast de sucesso reflete a quantidade criada (ex.: "3 horários criados").

### 2. Nova visualização "Grade semanal" na aba Horários
Inspirada na referência (Tecnofit), mas adaptada ao tema dark do software:

- Um seletor no topo da aba com dois modos: **Grade semanal** (novo, padrão) e **Lista por dia** (comportamento atual, preservado).
- Layout da grade:
  - Coluna esquerda fixa com os rótulos de horário (slots de 30 min do menor `horario_inicio` até o maior `horario_fim` cadastrado, com fallback 06:00–22:00 se vazio).
  - 7 colunas — uma por dia da semana (Seg–Dom, cabeçalho abreviado).
  - Cada slot cadastrado renderiza um card na coluna do seu dia, alinhado à linha do seu `horario_inicio` e com altura proporcional à duração (30 min = 1 linha).
  - Card mostra: horário início–fim, capacidade, nome do instrutor (se houver). Slots inativos aparecem esmaecidos.
  - Clique no card abre o diálogo de edição.
  - Scroll horizontal em mobile (grade não colapsa: melhor UX que espremer 7 colunas em 393 px).
- Botões "Novo Horário" e toggle Ativo continuam disponíveis.

### 3. Sem mudanças em banco, portal do aluno, ou aba Agendamentos
Toda a lógica é frontend — o schema de `treino_slots` já suporta múltiplos registros (um por dia).

## Detalhes técnicos

- Chips de dia: componentes `Toggle`/`Button` já disponíveis via shadcn.
- Insert em lote: `supabase.from("treino_slots").insert(payloads)` onde `payloads` é um array — dispara uma única round-trip.
- Grade: CSS grid com `grid-template-columns: 64px repeat(7, minmax(120px, 1fr))` e linhas de 32 px (30 min). Card posicionado com `gridColumn` (dia+2) e `gridRow` (linhas calculadas a partir de `horario_inicio`/`horario_fim`).
- Helper puro para converter `HH:MM` → índice de linha, testável isoladamente.
