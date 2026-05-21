## Objetivo
No fluxo Lead → Prospect (`ConvertToProspectDialog`), permitir selecionar um **Professor responsável**, que será gravado em `alunos.responsavel_id` e persistirá automaticamente nas próximas etapas (incluindo a conversão em Aluno, já que `ConvertToAlunoDialog` não sobrescreve esse campo).

## Mudanças

**Arquivo único:** `src/components/leads/ConvertToProspectDialog.tsx`

1. Adicionar estado `professores: { user_id, full_name }[]` e carregar no `useEffect`, replicando o padrão de `StudentFormFields.tsx`:
   - `select user_id, role from user_roles where role in ('professor','coordenador','admin')`
   - `select user_id, full_name from profiles where user_id in (...)`

2. Pré-carregar o responsável atual: no `useQuery` existente, incluir `responsavel_id` em `alunos.select`, e no `useEffect` que popula o form, definir `responsavel_id` inicial (string vazia se nulo).

3. Adicionar campo no form `responsavel_id: ""` e renderizar um `<Select>` "Professor responsável (opcional)" logo abaixo do campo "Como conheceu?", com placeholder "Selecione (opcional)" e a opção "— Nenhum —" para limpar.

4. No `save()`, depois do `convertLeadToProspect(...)` (que não toca em `responsavel_id`), fazer:
   - `supabase.from("alunos").update({ responsavel_id: form.responsavel_id || null }).eq("id", alunoId)` — sempre, para refletir mudança/limpeza.
   - Tratar erro via toast.

5. Não tornar obrigatório; manter os demais campos obrigatórios como estão.

## Por que persiste nas próximas etapas
- `alunos.responsavel_id` já existe e é lido por queries de carteira, comissionamento, perfil etc.
- `ConvertToAlunoDialog` faz `update` apenas em campos cadastrais (cpf, endereço, status) — não mexe em `responsavel_id`, portanto o vínculo definido na conversão para Prospect permanece quando o prospect vira Aluno.

## Fora de escopo
- Nenhuma mudança de banco/RLS (a policy "Coord/admin can update alunos" já permite que coord/admin atribuam o responsável; professores que estiverem convertendo o próprio lead já tinham `responsavel_id = auth.uid()` pela policy de insert).
- Sem alterações no Pipeline kanban ou em outras telas.