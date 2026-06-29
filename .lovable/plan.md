## Fix: CPF e PIS/PASEP não persistem ao salvar

**Diagnóstico**: a edge function `admin-users` (ação `update`) faz `UPDATE` em `public.profiles` filtrando por `user_id`. Confirmei no banco que **2 usuários autenticados não possuem linha em `profiles`** — para esses, o `UPDATE` retorna 0 linhas alteradas, sem erro, e o resultado é silenciosamente perdido. Também não há trigger criando `profiles` no insert em `auth.users`, então usuários antigos/migrados ficam sem linha. Hoje 0 de 10 perfis têm CPF/PIS, sinal de que muitas salvas vêm caindo nesse caminho silencioso (a função também é usada para editar perfis criados fora deste fluxo).

### Correções

1. `supabase/functions/admin-users/index.ts` — ação `update`:
   - Trocar `UPDATE … WHERE user_id = …` por `UPSERT` em `profiles` com `onConflict: "user_id"`, garantindo a criação da linha se faltar. Mantém `full_name` obrigatório no upsert lendo o nome atual quando o body não trouxer.
   - Validar (depois de `onlyDigits`) que `cpf` e `pis_pasep` têm exatamente 11 dígitos quando enviados (rejeita string parcial sem barrar limpeza com `null`).
   - Logar `console.log` do `user_id`, campos alterados e `count`/erro do upsert para diagnóstico futuro.
   - Retornar `{ ok: true, profile }` (linha resultante) para a UI confirmar.

2. `src/components/admin/AdminUsers.tsx`:
   - `updateMutation.onSuccess` invalida `admin-profiles` (já faz) e, se `data.profile` vier, faz `setQueryData` otimista para refletir CPF/PIS no editor sem aguardar refetch.
   - Pequeno aviso inline no input quando o usuário digita CPF/PIS com menos de 11 dígitos (não bloqueia, só sinaliza).

3. Backfill único (migração) para criar linhas em `profiles` para os 2 usuários auth que ainda não têm, evitando que edições futuras dependam do upsert: `INSERT … SELECT … WHERE NOT EXISTS`.

### Não muda
- Não altera o schema de `profiles` (colunas `cpf` e `pis_pasep` já existem como `text`).
- Não muda o fluxo `create`, que já faz upsert.
- Não altera RLS — a função usa `service_role`, que bypassa RLS.
