# Fortem Gestão Técnica

Sistema de gestão técnica para academia/estúdio Fortem (PT-BR).

## Stack

- React 18 + Vite 5 + TypeScript 5
- Tailwind CSS v3 + shadcn/ui
- Lovable Cloud (Supabase) — auth, DB, storage, edge functions

## Desenvolvimento

```bash
npm install
npm run dev
```

Variáveis de ambiente: veja `.env.example`.

## Testes

```bash
npx vitest run              # roda os testes
npx vitest run --coverage   # com cobertura
```

## Segurança

### Gateway e-Rede (2026-06-22)

Migração: `20260622000001_gateway_rede_tabelas.sql`

Tabelas: `cartoes_salvos`, `pagamentos_rede`, `webhook_events_rede`, `rate_limit_cobrancas`.
Edge Functions: `rede-cobrar-cartao`, `rede-cobrar-token`, `rede-cancelar`, `rede-webhook`.
Credenciais: armazenadas no `supabase_vault` (nunca em código).
Ambiente atual: **sandbox**.
PCI-DSS SAQ-A: PAN/CVV nunca persistidos. Sanitização em dupla camada (edge function + trigger BEFORE INSERT).



Todas as migrações de banco ficam em `supabase/migrations/` e são versionadas
junto com o código. Nunca edite o schema fora desse diretório — qualquer
alteração de tabela, policy, função ou trigger deve ser uma nova migração.

### Fase 1 de RLS — aplicada (2026-06-21)

Migração: `20260621000001_rls_fase1_seguranca.sql`

Habilita Row Level Security e políticas deny-by-default nas tabelas mais
sensíveis do sistema:

- `alunos` — dados pessoais de alunos/leads/prospects
- `avaliacoes` — dados de saúde e composição corporal
- `creditos_aluno` — saldo financeiro
- `comissionamentos` — valores salariais dos profissionais
- `pagamento_parcelas` — parcelas financeiras
- `clube_fortem_membros` — CPF hash e QR de acesso
- `legal_annexes` — CPF, assinatura digital, IP (LGPD)

Funções auxiliares criadas (`SECURITY DEFINER`, `search_path` fixo):

- `public.is_staff()` — true se o usuário tem role de equipe
  (admin, coordenador, professor, nutricionista ou fisioterapeuta)
- `public.is_admin_role()` — true se o usuário é admin

Modelo de acesso:

- **Staff** lê (e em geral edita) todos os registros operacionais
- **Admin** detém escrita destrutiva (insert/delete) e dados salariais
- **Aluno autenticado** acessa apenas os próprios dados via
  `alunos.user_id = auth.uid()`
- `legal_annexes` permite insert público para suportar o fluxo de assinatura
  sem login

### Próximas fases

- **Fase 2:** RLS em `user_roles`, `comissionamento_config`, `ponto_*`,
  `creditos_movimentos`, `consumo_servicos`, `notificacoes`
- **Fase 3:** Auditoria com `pg_audit`, conformidade LGPD
