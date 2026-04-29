
# Portal do Aluno FORTEM — MVP

Área separada do sistema interno, acessada pelo aluno com login próprio. Vínculo automático ao registro de aluno existente quando o email do login coincide com `alunos.email`.

Fora deste MVP (ficam para fases seguintes): agendamento de serviços, notificações, gamificação, integração WhatsApp, login social.

---

## 1. Autenticação e vínculo

- **Cadastro** com email + senha. Recuperação de senha completa (página `/portal/reset-password`).
- **Auto-vínculo por email** no primeiro login: ao logar, o portal procura `alunos.email = auth.email`. Se achar, vincula gravando `alunos.user_id`. Se não achar, mostra tela "Conta ainda não vinculada — fale com seu professor".
- **Role `aluno`** adicionada ao enum `app_role`. Atribuída automaticamente no signup pelo trigger `handle_new_user`.
- **Separação de UX**: rotas do aluno em `/portal/*` com layout próprio (sem AppSidebar interna, mobile-first). Tela de login dedicada em `/portal/login`.
- Usuários internos (professor/coord/admin) **não** acessam `/portal`; alunos **não** acessam o app interno (redirect baseado em role).

## 2. Layout do portal

`/portal` com bottom-nav mobile / sidebar simples desktop, 5 abas:

```text
[👤 Perfil] [🏋️ Treinos] [📊 Avaliações] [🎫 Clube] [📅 Agenda]
```

A aba **Agenda** entra como "Em breve" no MVP (placeholder), preservando a estrutura para a próxima fase.

## 3. Perfil (`/portal`)

- Foto, nome, email, status (Ativo/Licença/Encerrado), plano contratado.
- **Cards de créditos** (Avaliação Funcional, Consulta Nutrição, Consulta Reabilitação, Avaliação Física):
  - Total contratado · Utilizado · Saldo restante · barra de progresso.
  - Reaproveita a lógica de `consumo_servicos` já usada em `StudentServicos` (compras vs. usos via `agenda_id`/`uso_manual`).
- Botão "Sair".

## 4. Treinos (`/portal/treinos`)

- **Treino atual** em destaque (treinos com `status='atual'`), histórico abaixo.
- Renderiza usando o mesmo `WorkoutDetail` em `readOnly` (já existe).
- **Modal por exercício**: vídeo (YouTube/upload), nome, instruções, observações do professor.
- **Marcar como concluído** (sessão diária):
  - Nova tabela `student_workout_progress` (aluno_id, treino_id, data, concluido_em).
  - Indicador visual de progresso semanal: "X/Y treinos esta semana" com base em `frequencia_semanal`.

## 5. Avaliações (`/portal/avaliacoes`)

- Lista somente leitura das `avaliacoes` do aluno.
- Reusa `AssessmentViewerDialog` existente.
- Destaque para a mais recente; histórico abaixo.

## 6. Clube FORTEM (`/portal/clube`)

- **Carteirinha digital** reusando `MembershipCard` + `MembershipQR` (já existem) com dados de `clube_fortem_membros`.
- QR rotativo (já implementado via `fn_clube_generate_qr_token`).
- Lista de **parceiros e benefícios** com filtro por categoria (reusa dados de `parceiros` + `beneficios`).
- Botão "Adicionar à carteira" — placeholder visual, integração Apple/Google Wallet fica para próxima fase.

## 7. Agenda (`/portal/agenda`)

Placeholder "Em breve" no MVP.

---

## Detalhes técnicos

### Banco de dados (uma migration)

```sql
-- Adiciona role aluno
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'aluno';

-- Vínculo auth ↔ aluno
ALTER TABLE alunos ADD COLUMN user_id uuid UNIQUE;
CREATE INDEX idx_alunos_user_id ON alunos(user_id);

-- Progresso de treino
CREATE TABLE student_workout_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  treino_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, treino_id, data)
);
ALTER TABLE student_workout_progress ENABLE ROW LEVEL SECURITY;

-- Função: vínculo automático no primeiro login
CREATE OR REPLACE FUNCTION public.fn_portal_link_aluno()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _email text; _aluno_id uuid;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  UPDATE alunos SET user_id = _uid
   WHERE email = _email AND user_id IS NULL
   RETURNING id INTO _aluno_id;
  IF _aluno_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role) VALUES (_uid, 'aluno')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('linked', _aluno_id IS NOT NULL, 'aluno_id', _aluno_id);
END $$;
```

### RLS (novas/ajustadas)

- `alunos`: nova policy SELECT/UPDATE para `user_id = auth.uid()` (apenas seu próprio registro).
- `treinos`, `avaliacoes`, `avaliacao_funcional`, `consumo_servicos`, `planos`, `clube_fortem_membros`, `beneficios`, `parceiros`: adicionar policy SELECT permitindo `EXISTS(SELECT 1 FROM alunos WHERE id = X.aluno_id AND user_id = auth.uid())` (ou todos os autenticados, no caso de `parceiros`/`beneficios`).
- `student_workout_progress`: aluno gerencia apenas o próprio (`aluno_id IN (SELECT id FROM alunos WHERE user_id = auth.uid())`).
- `fn_clube_generate_qr_token`: ajustar para permitir o próprio aluno (`alunos.user_id = auth.uid()`).

### Estrutura de arquivos

```text
src/
  pages/portal/
    PortalLogin.tsx
    PortalSignUp.tsx
    PortalResetPassword.tsx
    PortalProfile.tsx
    PortalWorkouts.tsx
    PortalAssessments.tsx
    PortalClube.tsx
    PortalAgenda.tsx          (placeholder)
  components/portal/
    PortalLayout.tsx          (bottom-nav mobile, top-nav desktop)
    PortalCreditsCard.tsx
    PortalWorkoutCard.tsx
    PortalExerciseModal.tsx
    PortalProgressBar.tsx
  contexts/
    StudentPortalContext.tsx  (resolve aluno_id a partir de auth, expõe via hook)
```

Rotas em `App.tsx`: novo bloco `<Route path="/portal/*">` com `PortalLayout`. Guard `RequireStudent` redireciona profissionais para `/`.

### Reuso

- `WorkoutDetail` (readOnly), `AssessmentViewerDialog`, `MembershipCard`, `MembershipQR`, `PartnersList` (já existentes) são reaproveitados sem fork.
- Visual segue tokens atuais (dark, primary verde, `glass-card`, DM Sans/Inter).

---

## Plano de execução

1. Migration: enum `aluno`, `alunos.user_id`, `student_workout_progress`, função `fn_portal_link_aluno`, novas policies RLS.
2. Rotas e layout do portal (`/portal/*`, login, signup, recover, layout mobile-first).
3. Aba Perfil + cards de créditos.
4. Aba Treinos + modal de exercício + marcar concluído + barra semanal.
5. Aba Avaliações (somente leitura).
6. Aba Clube (carteirinha + QR + lista de parceiros com filtro).
7. Placeholder da Agenda + ajustes finais e testes de RLS.
