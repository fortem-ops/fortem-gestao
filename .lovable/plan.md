# 2FA obrigatória para a equipe (TOTP nativo)

Li o AGENTS.md da raiz. Regras aplicadas: teste de regressão, `bunx vitest run` + eslint, sem `any`, funções novas sem EXECUTE para `anon`.

## Situação confirmada no banco (só leitura)
- Funções de papel usadas pelas policies (nº de policies que citam): `is_staff()` 135, `is_staff(uuid)` 135, `is_coordinator_or_admin(uuid)` 144, `is_coordenador_ou_admin()` 91, `has_role(uuid, app_role)` 58, `is_admin(uuid)` 48, `is_admin_role()` 33, `is_professor_staff()` 14, `is_staff_or_aluno()` 14, `aluno_user_id(uuid)` 2.
- Policies que leem `user_roles` direto (sem helper): 1 em `notificacao_destinatarios`, 1 em `storage.objects`.
- Usuários sem papel (não serão alterados):

| E-mail | Último login |
|---|---|
| teste.pro@fortem.app | 06/11/2026 |
| wingert.marcia@gmail.com | 19/09/2026 |
| igorniederauer@gmail.com | nunca |
| teste.nicolas@fortem.app | nunca |

Status: Fase 1 implementada (sem migração). Fase 2 aguarda pedido separado.

## Fase 1 — cadastro obrigatório + bloqueio na tela
1. **Login da equipe** (`/login`): depois de e-mail e senha, o sistema checa o nível da sessão (`mfa.getAuthenticatorAssuranceLevel`).
   - Tem fator verificado e sessão em aal1 → tela "Digite o código de 6 dígitos". Erro: "Código incorreto ou expirado. Confira o horário do celular e tente de novo." Pode tentar de novo sem refazer a senha.
   - Sem fator → tela obrigatória "Ativar verificação em duas etapas": QR code, código manual (com botão copiar), campo de 6 dígitos para confirmar. Só libera após verificar (sessão vira aal2).
2. **Bloqueio de rotas**: `ProtectedRoute requireStaff` passa a exigir aal2 para quem tem papel de equipe. Equipe em aal1 é levada para `/login/2fa` (desafio ou cadastro). Botão "Sair" sempre disponível.
3. **Aluno**: portal e app não mudam. O teste de papel decide; aluno nunca vê a tela de 2FA.
4. **Aparelho reserva**: em "Minha conta" (ou menu do usuário), botão "Adicionar aparelho reserva" (2º fator TOTP com nome, ex.: "Reserva"). Mostra a lista dos aparelhos do próprio usuário.
5. **Tela de usuários** (`AdminUsers.tsx`): coluna "2FA" — Ativo (verde) / Pendente (amarelo) — para usuários de equipe; visível a admin e coordenador. Dados vêm da nova ação `list-mfa` da função `admin-users` (lê `auth.admin.mfa.listFactors`, só staff).
6. **Redefinir 2FA** (só admin): botão "Redefinir 2FA" na linha do usuário, com confirmação. Ação `reset-mfa` na `admin-users`:
   - recusa se `user_id` = quem chama ("Você não pode redefinir o seu próprio 2FA");
   - recusa se o alvo não for de equipe;
   - apaga todos os fatores (`auth.admin.mfa.deleteFactor`) e grava no `audit_log` (quem, para quem, quando, quantos fatores).
   - O usuário cadastra de novo no próximo login.
7. `admin-users` e `_shared/admin-ativo.ts`: nesta fase só **leem** o aal (para log), sem bloquear.

Na Fase 1 o servidor ainda aceita aal1 — é a janela para os 10 cadastrarem.

## Consulta para conferir antes da Fase 2
```sql
select u.email, string_agg(distinct r.role::text, ',') papeis,
       count(f.id) filter (where f.status='verified') fatores_ok
from auth.users u
join user_roles r on r.user_id=u.id and r.role <> 'aluno'
left join auth.mfa_factors f on f.user_id=u.id
group by u.email order by fatores_ok, u.email;
```
Ligar a Fase 2 só quando todas as linhas tiverem `fatores_ok >= 1`.

## Fase 2 — imposição no servidor
**Princípio**: uma função nova `public.aal_ok()` = `coalesce(auth.jwt()->>'aal','') = 'aal2'`. Os helpers retornam verdadeiro para papel de equipe só se `aal_ok()`. Papel `aluno` nunca depende de aal. Como as policies chamam os helpers, nenhuma das ~670 policies precisa ser reescrita.

Funções alteradas (`CREATE OR REPLACE`, mesma assinatura e mesmo `SECURITY DEFINER`/`search_path`):
- `is_staff()`, `is_staff(uuid)`, `is_admin(uuid)`, `is_admin_role()`, `is_coordinator_or_admin(uuid)`, `is_coordenador_ou_admin()`, `is_professor_staff()` → `... AND aal_ok()`.
- `has_role(uuid, app_role)` → exige `aal_ok()` só quando `_role <> 'aluno'`.
- `is_staff_or_aluno()` → parte de equipe exige aal2; parte de aluno inalterada.
- `aluno_user_id` não muda.
- Quando `_user_id` ≠ `auth.uid()` (checagem de outro usuário, ex. em triggers), o aal **não** é exigido — o aal é da sessão de quem chama, não do alvo.

Policies alteradas (as 2 que leem `user_roles` direto): `notificacao_destinatarios` e a de `storage.objects` passam a usar o helper equivalente (ou recebem `AND aal_ok()`). Nome exato das policies será lido e listado na migração antes de aplicar.

Edge functions:
- `_shared/admin-ativo.ts`: decodifica o JWT validado e exige `aal = 'aal2'`.
- Funções que checam papel por conta própria com token de usuário (`admin-users` e as que usam `adminAtivo`, `whatsapp-midia`, `notify-agenda-evento` quando chamadas pela tela): mesma exigência via um helper novo `_shared/staff-aal.ts`. Na implementação levanto a lista completa com `rg` antes de editar.
- Não mudam: chamadas com `service_role` (crons `planos-recorrencia-diario`, `ponto-banco-expirar`, `conciliar-extrato-diario`, `ipca-atualizar`, webhooks Rede/Inter `pix-webhook`, agente facial). `service_role` ignora RLS e não passa pelos helpers com aal; `auth.jwt()` não tem aal mas também não é usado nesses caminhos.
- Páginas públicas (`anon`): continuam iguais — usam as 19 funções liberadas para anon, que não dependem dos helpers de equipe. Vou rodar de novo os testes REST anon do último ajuste de segurança.

Interruptor: `aal_ok()` lê um flag em tabela de configuração (`seguranca_config.mfa_servidor_ativo`). Só `service_role` altera o flag: sem policy de escrita para admin ou qualquer usuário (leitura só admin). Motivo: um token de admin em aal1 não pode desligar a própria proteção. Ligar e desligar a Fase 2 é um `UPDATE` feito pelo servidor, sem nova migração.

## Migrações
- **Fase 1**: nenhuma mudança de schema; só a ação `reset-mfa` grava no `audit_log` existente (via service_role).
- **Fase 2 (migração `mfa_aal2_servidor`)**: cria `seguranca_config` (GRANT + RLS, leitura só admin, escrita só `service_role`, flag começa `false`), cria `aal_ok()` (sem EXECUTE para anon), recria os 9 helpers e ajusta as 2 policies. Ativação: `update seguranca_config set mfa_servidor_ativo = true` só depois da consulta acima.

## Arquivos que mudam
- `src/contexts/AuthContext.tsx` (nível aal, desafio, cadastro)
- `src/components/ProtectedRoute.tsx` (exige aal2 para equipe)
- `src/lib/authAccess.ts` + novo `src/lib/mfa.ts` (regras puras testáveis)
- novas: `src/pages/MfaVerificar.tsx`, `src/components/auth/MfaCadastro.tsx`, `src/components/auth/MfaDesafio.tsx`, `src/components/auth/MfaAparelhos.tsx`
- `src/App.tsx` (rota `/login/2fa`)
- `src/components/admin/AdminUsers.tsx` (coluna 2FA, botão Redefinir)
- `supabase/functions/admin-users/index.ts` (`list-mfa`, `reset-mfa`, exige aal2 na Fase 2)
- `supabase/functions/_shared/admin-ativo.ts` + novo `_shared/staff-aal.ts`
- testes: `src/test/mfaAcesso.test.ts`, `supabase/functions/_shared/__tests__/staff-aal.test.ts`
- `AGENTS.md`: regra "equipe exige aal2 via helpers; aluno nunca".

## Testes de regressão
- Equipe sem fator → destino é cadastro; com fator em aal1 → desafio; aal2 → libera.
- Aluno (qualquer aal) → não é levado ao 2FA.
- Fase 2: helper falso para equipe em aal1, verdadeiro em aal2, aluno verdadeiro em aal1 (teste SQL com `set request.jwt.claims` dentro de transação com rollback).
- `reset-mfa` recusa o próprio usuário e alvo aluno.

## Telas para você testar
1. Login de admin → cadastro com QR no Authenticator → entra.
2. Sair e entrar de novo → pede código; testar código errado.
3. Adicionar aparelho reserva e entrar com ele.
4. Usuários → coluna 2FA; "Redefinir 2FA" em outro usuário; confirmar que no seu próprio não aparece.
5. Portal do aluno com Google → nada muda.
6. Fase 2 ligada: telas de Vendas, Agenda, Financeiro, Ponto logado em aal2; `/planos`, `/10anos` sem login.

## Como desfazer
- **Fase 1**: reverter o commit do frontend (a tela de 2FA some; fatores cadastrados ficam guardados sem efeito). Emergência de um usuário: admin usa "Redefinir 2FA".
- **Fase 2**: `update seguranca_config set mfa_servidor_ativo = false` — efeito imediato, servidor volta a aceitar aal1. Reversão total: nova migração recriando os helpers sem `aal_ok()`.
- Se os 2 admins perderem acesso ao mesmo tempo: apagar o fator pelo banco (`delete from auth.mfa_factors where user_id = ...`) feito por mim, a seu pedido.

## Pontos para você decidir
- Coordenador também pode redefinir 2FA? (plano: só admin, como você pediu.)
- O que fazer com os 4 usuários sem papel (tabela acima).
