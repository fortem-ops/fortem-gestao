## Problema
Em `/alunos` (Cadastros), no mobile (<768px) apenas as colunas Nome e checkbox aparecem — todas as outras (Status, Plano, Frequência, Professor, Início/Final Plano, Última Aval. Funcional, Serviços) ficam ocultas via `hidden md:table-cell`. O usuário perde informação essencial no celular.

## Solução
Renderização condicional: **tabela tradicional no desktop**, **lista de cards no mobile**, com todas as informações empilhadas abaixo do nome de cada aluno.

### Mudanças em `src/pages/StudentList.tsx`

1. **Envolver a tabela atual em `<div className="hidden md:block">`** para que ela só apareça em telas ≥ md.

2. **Adicionar abaixo um bloco `<div className="md:hidden space-y-2">`** que itera sobre `filtered` e renderiza, para cada aluno, um card com:
   - Linha 1: checkbox de seleção + nome (link) + badge de status (lado direito).
   - Email em texto pequeno (muted).
   - Grid 2 colunas com pares **rótulo: valor** para: Plano, Frequência, Professor, Início Plano, Final Plano (cor destrutiva se vencido), Última Aval. Funcional (com cor de severidade).
   - Linha "Serviços do Plano:" + `CreditsCell` (se houver entradas).
   - Linha "Serviços Contratados:" + `CreditsCell` (se houver entradas).
   - Card inteiro clicável navegando para `/alunos/${id}`, exceto checkbox (com `stopPropagation`).
   - Mesmos estados de loading (skeletons) e empty state.

3. **Reutilizar** as funções/lógica já existentes no `.map()` da tabela (`professorName`, `planEndStr`, `isPlanExpired`, `lastFunc*`, `getDisplayStatus`, `CreditsCell`) — extrair para uma função interna `renderStudentRowData(student)` que devolve um objeto com os valores formatados, usado tanto na tabela quanto nos cards, evitando duplicação.

## Resultado esperado
- Mobile: cards com todas as informações visíveis, sem scroll horizontal.
- Desktop (≥md): tabela inalterada.

## Arquivo
- `src/pages/StudentList.tsx`