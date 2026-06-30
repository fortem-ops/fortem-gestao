## Objetivo
Bloquear a edição direta de Fases 1–4 e Corrida 1–4 mesmo para Coord/Admin: ao abrir, a base entra em **somente leitura**. Coord/Admin vê um botão **Editar** no topo; ao clicar, libera os campos. Quando termina, clica em **Salvar** (vira "Salvo ✓") e a base volta a ficar travada. Professores não veem o botão.

## Alterações

### 1. `TemplateDetail` (Fases 1–4) em `src/pages/BancoTreinos.tsx`
- Adicionar `const [editing, setEditing] = useState(false)` dentro do componente.
- O `canEdit` que hoje é passado para `ExerciseTable`/`ExerciseRow` passa a ser `canEdit && editing` (controles inline ficam travados até clicar em Editar).
- No cabeçalho do detalhe (ao lado do "Somente leitura"):
  - Se `canEdit && !editing` → botão **Editar** (`Pencil`).
  - Se `canEdit && editing` → botão **Salvar** (`Save`) que chama `setEditing(false)` e dispara `toast.success("Base atualizada")`. As mutations já persistem on-blur, então o botão apenas encerra o modo de edição.
  - Mostrar badge "Editando…" durante o modo edição; manter "Somente leitura" quando aplicável.
- Para usuários sem `canEdit`, nada muda (continua read-only sem botões).

### 2. Corrida 1–4 — `PersonalizadoEditor`
- Adicionar prop opcional `lockedByDefault?: boolean`.
- Quando `lockedByDefault` é true, o componente inicia com um estado interno `locked=true` que se sobrepõe a `readOnly` (efetivo: `readOnly || locked`).
- Mostrar no header:
  - `locked` → botão **Editar** (somente se o `readOnly` original for false, ou seja, usuário tem permissão).
  - `!locked` → botão **Salvar** que chama `handleSaveModelo()` e, em sucesso, volta a `locked=true` com toast "Base atualizada".
- Em `src/pages/BancoTreinos.tsx`, ao abrir um card de Corrida para coord/admin, passar `lockedByDefault` quando `canEdit`. Professores continuam recebendo `readOnly={true}` (sem botão Editar).

## Escopo de arquivos
- `src/pages/BancoTreinos.tsx` — estado `editing` no `TemplateDetail` + botões; passagem de `lockedByDefault` para `PersonalizadoEditor` nas Corridas.
- `src/components/student/workout/PersonalizadoEditor.tsx` — nova prop `lockedByDefault` + estado interno `locked` + botão Editar/Salvar no cabeçalho.

Nenhuma mudança em RLS, em modelos personalizados de professores, ou no fluxo de aplicar treino a alunos.