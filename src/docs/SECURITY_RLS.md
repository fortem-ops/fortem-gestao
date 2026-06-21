# Segurança — Row Level Security (RLS)

## Fase 1 — Tabelas críticas (aplicado em 2026-06-21)

### Como aplicar no Supabase

1. Acesse o **SQL Editor** no painel do Supabase
2. Abra o arquivo `supabase/migrations/20260621000001_rls_fase1_seguranca.sql`
3. Cole o conteúdo e clique em **Run**
4. Verifique em **Authentication → Policies** que as políticas aparecem nas tabelas

### Tabelas protegidas

| Tabela | RLS | Políticas |
|--------|-----|-----------|
| `alunos` | ✅ | Staff lê tudo; aluno lê o próprio; admin/coord insere; admin deleta |
| `avaliacoes` | ✅ | Staff acesso total; aluno lê as próprias |
| `creditos_aluno` | ✅ | Staff acesso total; aluno lê os próprios |
| `comissionamentos` | ✅ | Admin/coord total; profissional lê os próprios |
| `pagamento_parcelas` | ✅ | Admin/coord total; aluno lê as próprias |
| `clube_fortem_membros` | ✅ | Staff total; aluno lê o próprio (sem expor qr_secret de outros) |
| `legal_annexes` | ✅ | Staff total; aluno lê os próprios; anon pode inserir (fluxo /assinar) |

### Funções helper criadas

- `public.is_staff()` — verifica se uid tem papel de staff
- `public.is_admin(uuid)` — verifica se uid é admin (SECURITY DEFINER)
- `public.is_coordinator_or_admin(uuid)` — verifica coord/admin (SECURITY DEFINER)
- `public.aluno_user_id(uuid)` — resolve user_id de um aluno

### Em caso de emergência

Execute o arquivo `supabase/migrations/20260621000001_rls_fase1_rollback.sql` para desativar todas as políticas desta fase.

### Próximas fases

- **Fase 2:** Políticas para `user_roles`, `ponto_jornadas`, `ponto_eventos`, `comissionamento_config`, `notificacoes`
- **Fase 3:** Auditoria com `pg_audit`, conformidade LGPD
