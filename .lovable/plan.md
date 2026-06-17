## Banco de Treinos — remover "Personalizado 2" e marcar 3 planilhas como "Em Construção"

Alterações apenas em `src/pages/BancoTreinos.tsx` (seção "Métodos"). Sem mudanças de banco.

### 1. Remover "Personalizado 2"
- Tirar `"Personalizado 2"` do filtro de **Métodos** (`PHASE_GROUPS`), de modo que o card deixa de ser renderizado.
- Remover a branch `else if (template.fase === "Personalizado 2")` do `onClick` (não mais alcançável).
- Manter `emptyPersonalizado2()` e `seedFromWorkoutTemplate()` no arquivo por ora (não geram efeito sem o card); podem ser removidos depois sem risco.

### 2. "Planilha 5RM", "5-3-1" e "M102" → Em Construção
- Os 3 cards continuam visíveis na seção Métodos.
- Cabeçalho usa ícone `Construction` (lucide) em vez de `Dumbbell`.
- Badge amarelo **"Em Construção"** no canto superior direito (substitui o badge de frequência).
- Card com `cursor-not-allowed` e leve opacidade.
- Clique exibe toast: `"Em Construção — Este modelo ainda não está disponível."` e não abre o template.

### Detalhes técnicos
- Adicionar `Construction` ao import do `lucide-react`.
- Dentro do `.map(template => ...)` do grid de Métodos, definir:
  - `isUnderConstruction = ["Planilha 5RM", "5-3-1", "M102"].includes(template.fase)`
- Ramificar `className`, `onClick`, ícone e badge com base nessa flag.
- Toast via `sonner` (já importado).
