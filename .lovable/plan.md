## Problema

No Dashboard, o filtro "Filtrar por professor" só aparece para coord/admin e busca a lista em `user_roles`. A política RLS atual de `user_roles` é **"Self or admin can view roles"** — então um coordenador só lê a própria linha e o filtro fica vazio (exibe só o próprio nome). Admins funcionam porque o policy inclui `is_admin`.

## Mudança

**Migração SQL** — substituir a política SELECT de `user_roles` para também permitir coordenadores, ficando alinhado com a regra "ADM ⊆ Coord":

```sql
DROP POLICY IF EXISTS "Self or admin can view roles" ON public.user_roles;
CREATE POLICY "Self or coord/admin can view roles"
  ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR is_coordinator_or_admin(auth.uid()));
```

Nenhuma alteração de código é necessária — a query `dashboard-professors` em `src/pages/Dashboard.tsx` passa a retornar todos os professores/coordenadores/admins automaticamente quando o usuário logado é coordenador.

Efeito colateral positivo (alinhado com o sistema RBAC): coordenadores poderão alimentar outros filtros que dependem da mesma listagem (ex.: agenda, relatórios), o que já era o comportamento esperado para a hierarquia Professor → Coordenador → Admin.

## Arquivos

- Migração: relaxar política SELECT de `public.user_roles` para incluir coordenadores.