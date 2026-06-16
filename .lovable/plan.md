# Gerenciamento de Usuários (Admin)

Permitir que apenas Administradores criem, editem e excluam usuários em Administração → Usuários & Permissões, com atualização imediata da lista.

## 1. Banco de dados (migration)
- Adicionar policies na tabela `public.profiles`:
  - UPDATE: `is_admin(auth.uid())` (mantém a policy existente de auto-edição)
  - DELETE: `is_admin(auth.uid())`

## 2. Edge function `admin-users` (nova)
`supabase/functions/admin-users/index.ts` — somente Admin, usa `SUPABASE_SERVICE_ROLE_KEY` para operar em `auth.users`.

- Valida JWT do chamador via `auth.getUser()` + RPC `is_admin`. Sem admin → 403.
- Ações (Zod validado):
  - `create`: cria usuário em `auth.users` (email confirmado), cria `profiles` (full_name, phone, specialty) e opcionalmente insere role inicial em `user_roles`.
  - `update`: atualiza email/senha em `auth.users` (quando informados) e campos em `profiles`.
  - `delete`: `auth.admin.deleteUser` (bloqueia auto-exclusão).
- Retorna sempre com `corsHeaders`.

## 3. UI — `src/components/admin/AdminUsers.tsx`
- Detecta Admin via RPC `is_admin`; oculta ações para não-Admin.
- Botão **"Novo Usuário"** → dialog (Nome, Email, Senha inicial, Telefone, Especialidade, Permissão inicial opcional).
- Botão **Editar** por linha → dialog pré-preenchido (Nome, Email, Telefone, Especialidade, "Alterar senha" opcional).
- Botão **Excluir** por linha → AlertDialog de confirmação; desabilitado para o próprio usuário.
- Lista de e-mails: nova query `admin-users-emails` chamando a edge function (action `list-emails`) já que `auth.users` não é acessível pelo client.
- Após cada ação: `queryClient.invalidateQueries(["admin-profiles"])`, `["admin-user-roles"]` e `["admin-users-emails"]` — atualização imediata sem usar o chat.

## Ordem
1. Migration (policies) → 2. Edge function `admin-users` → 3. UI no `AdminUsers.tsx`.
