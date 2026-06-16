## 1. Alertas 30 min antes (Avaliações / Treino Exp.)

**Origem dos eventos:** `agenda_servicos` — itens cujo `atividade` contenha "avalia" (Avaliação Funcional) ou "experimental" (Treino Experimental), considerando `data_especifica = hoje` (tipo `unico`) ou `dia_semana = hoje` (tipo `fixo`), excluindo cancelamentos em `agenda_servicos_excecoes`.

**Edge function nova:** `notify-agenda-proximos` (rodada por `pg_cron` a cada 5 min)
- Para cada evento que começa em ≤ 30 min e > 25 min a partir de `now()` (janela 5min p/ evitar duplicar):
  - Cria registro em `notificacoes` (categoria `agenda`, prioridade `alta`, destinatário = `profissional_id`) — gera o sino do sistema.
  - Enfileira e-mail via `send-transactional-email` com novo template `agenda-evento-proximo` (assunto: "Em 30 min: {atividade} — {hora}"). Inclui aluno, local e link p/ `/agenda`.
- Idempotência: `idempotencyKey = agenda-proximo-{agenda_id}-{data}`. Tabela `agenda_notificacoes_log` existente é usada para marcar `tipo='proximo_30min'` e evitar reenvio.

**Cron:** novo job `notify-agenda-proximos-5min` (`*/5 * * * *`) via `supabase--insert` (URL+anon key no SQL).

**Email infra:** se ainda não houver domínio/infra configurada, abre o diálogo de setup antes; scaffold do template.

## 2. Professores não podem cadastrar alunos

**RLS (`alunos` INSERT):** substitui a política `Authenticated users can insert alunos` por:
```
WITH CHECK (is_coordinator_or_admin(auth.uid()))
```
(somente Coordenador/Admin inserem; importação CSV roda no contexto do usuário logado, então também fica restrita — alinhado ao pedido).

**UI:** em `src/pages/StudentList.tsx` e onde mais aparecer, `<AddStudentDialog>` só renderiza se `isCoordinator || isAdmin`. Mesmo trato para `ImportStudentsCSVDialog` e botões "Novo Aluno" em Prospects/Carteira (se existirem).

## 3. Frequência "Livre" passa de 0 → 5

**Migração de dados:**
```sql
UPDATE public.alunos SET frequencia_semanal = 5 WHERE frequencia_semanal = 0;
```
(via `supabase--insert`)

**Código:** trocar todas as comparações `=== 0 ? "Livre"` por `=== 5 ? "Livre"` e o `value="0"` do select Livre para `value="5"`. Arquivos:
- `src/pages/StudentList.tsx` (linhas 224, 551, 666)
- `src/components/student/StudentFormFields.tsx` (linha 301; também ampliar `z.coerce.number().int().min(0).max(3)` → `max(7)` p/ aceitar 5)
- `src/components/student/AddStudentDialog.tsx` (default `frequencia_semanal: 3` ok; nada a mudar além do schema)
- `src/components/student/EditStudentDialog.tsx`
- `src/components/student/StudentSummary.tsx` (linhas 383, 447)
- `src/components/avaliacoes-premium/AlunoSidebarCard.tsx`
- `src/components/clube/AdminBeneficiosTable.tsx` (independente — não tocar; refere benefícios)
- `src/lib/studentImport.ts` (ajustar texto "0–3" para "1–7" e mapear "livre"→5)
- `src/pages/CarteiraAlunos.tsx`, `src/pages/StudentProfile.tsx`, `src/pages/portal/PortalWorkouts.tsx` (exibição "Livre" quando 5)

## Ordem de execução

1. Migration SQL: altera RLS de `alunos` (INSERT só coord/admin).
2. Data update: `frequencia_semanal 0 → 5`.
3. Setup de e-mail (se necessário) + scaffold template `agenda-evento-proximo`.
4. Criar edge function `notify-agenda-proximos` + cron `*/5 * * * *`.
5. Edits de UI (RBAC do AddStudentDialog + troca Livre 0→5 nas telas).
6. Deploy das edge functions.
