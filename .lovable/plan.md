## Mudanças

### 1) Importar do Banco de Treinos: mostrar "Meus Modelos" e "Modelos de outros professores"

Hoje o `ImportFromBankDialog` lista apenas os templates fixos (`WORKOUT_TEMPLATES`) agrupados em Fases / Métodos / Corrida. Vou adicionar duas seções extras (espelhando o que já existe em `BancoTreinos.tsx`):

- **Meus Modelos** — modelos de `banco_treinos_personalizados` cujo `criado_por = user.id`.
- **Modelos {Nome do Professor}** — uma seção por outro autor, ordenada por nome.

Arquivo: `src/components/student/workout/ImportFromBankDialog.tsx`

- Nova `useQuery` `banco-treinos-personalizados-import` carregando `id, nome, conteudo, criado_por, updated_at` de `banco_treinos_personalizados` (filtrando fora os nomes que coincidem com templates "Corrida", como já é feito em `BancoTreinos.tsx`).
- Nova `useQuery` `banco-treinos-autores-import` para resolver `full_name` em `profiles` (com fallback "Professor").
- Renderizar as seções abaixo dos `PHASE_GROUPS`, com cards no mesmo estilo (`glass-card`, ícone `Sparkles`, nome do modelo + nº de treinos + data).
- Ao clicar em um modelo personalizado: converter `conteudo` via `flattenPersonalizado(conteudo)` (já exportado em `personalizadoTypes.ts`) e abrir o `WorkoutDetail` passando `templateData` pronto e `fase = m.nome`. Isso pula a etapa de `applyEscolhas` (não há vínculos de banco para personalizados — eles já trazem `exercicio_id`/`video_url` embutidos).
- Estado interno: trocar `selected: WorkoutTemplate | null` por um union `{ kind: "template", template } | { kind: "personalizado", nome, data }` para suportar as duas origens sem mudar `WorkoutDetail`.

Sem mudança de RLS — `banco_treinos_personalizados` já tem SELECT `true` para autenticados.

### 2) Excluir treinos personalizados disponível para todos os professores

Hoje o botão de excluir em `BancoTreinos.tsx` (linha 1220) usa `canManage = isOwner || canEdit` (onde `canEdit = admin || coordenador`). Além disso, a política RLS de DELETE em `banco_treinos_personalizados` é `auth.uid() = criado_por OR is_coordinator_or_admin(auth.uid())`, então mesmo se a UI deixasse o botão visível, o delete falharia para professor que não é o autor.

Duas alterações:

a) **Migração SQL** — substituir a política DELETE para permitir qualquer staff (professor / nutri / fisio / coord / admin):

```sql
DROP POLICY "Author or coord/admin can delete personalizados" ON public.banco_treinos_personalizados;
CREATE POLICY "Staff can delete personalizados"
  ON public.banco_treinos_personalizados
  FOR DELETE TO authenticated
  USING (is_staff(auth.uid()));
```

b) **UI** — em `src/pages/BancoTreinos.tsx` linha 1220, mudar a condição de exibição dos botões para que o botão **Excluir** apareça para qualquer usuário staff. Manter o botão **Editar** com a regra atual (`isOwner || canEdit`) para não alterar a permissão de edição (o usuário pediu explicitamente apenas a exclusão).

Concretamente: dividir o bloco `{canManage && (<Edit/><Delete/>)}` em dois — `{(isOwner || canEdit) && <Edit/>}` e `{<Delete/>}` sempre visível para staff logado.

### Resumo de arquivos

- `src/components/student/workout/ImportFromBankDialog.tsx` — adicionar seções "Meus Modelos" / "Modelos de outros professores" e suportar abrir personalizado via `flattenPersonalizado`.
- `src/pages/BancoTreinos.tsx` — separar botão Excluir do gating de Editar, deixando-o sempre visível.
- Migração: relaxar política DELETE de `banco_treinos_personalizados` para qualquer staff autenticado.