
## Módulo Anexos Jurídicos — Plano de Integração

Objetivo: portar o fluxo de assinatura do "Consent & Care" (Anexo I de Aptidão Física e Uso de Imagem) para o Software da Fortem como um novo módulo dentro de **Cadastros**, com vinculação automática ao aluno pelo CPF.

### Visão geral

```text
Público (sem login):
  /assinar               → Anexo padrão (5 etapas)
  /assinar-experimental  → Treino Experimental (sem etapa de imagem)

Admin (logado):
  /anexos                → Painel de gestão (lista, filtros, detalhes, exclusão)

Cadastros > Anexos       → novo item na sidebar (apenas Admin)
Ficha do Aluno           → mini-aba "Anexo Jurídico" mostrando o último anexo vinculado por CPF
```

### Banco de dados (1 migration)

1. **Tabela `legal_annexes`**
   - Campos: `nome`, `cpf` (único + index), `data_nascimento`, `telefone`, `email`, `emergency_contact_name`, `emergency_contact_phone`, `medical_status` ('ok' | 'restricao'), `image_usage` (bool), `signature_data` (text), `attachment_url`, `ip_address`, `document_type` ('anexo' | 'experimental'), `signed_at`, `valid_until` (default: signed_at + 1 ano), `aluno_id` (FK opcional para `alunos.id`).
   - Validação por **trigger** (não CHECK) para `medical_status` e `document_type`.
2. **Coluna `cpf` em `alunos`** (texto nullable, index único parcial onde não nulo) — base para a vinculação automática.
3. **Trigger `trg_legal_annex_link_aluno`**: ao inserir/atualizar anexo, faz match pelo CPF normalizado e preenche `aluno_id` automaticamente.
4. **RLS de `legal_annexes`**:
   - INSERT: `anon` + `authenticated` (formulário público).
   - SELECT/UPDATE/DELETE: apenas `is_admin(auth.uid())`.
5. **Storage bucket `legal_annex_attachments`** (público para leitura), políticas:
   - Upload: anon + authenticated.
   - Leitura pública (URL nos emails/painel).
   - Delete: apenas Admin.

### Edge functions

1. **`submit-legal-annex`** — porta direta do projeto Consent & Care:
   - Sobe assinatura como PNG no bucket.
   - Faz upsert do anexo (CPF + tipo de documento como chave lógica).
   - Envia email de confirmação via Gmail SMTP. Requer secret `GMAIL_APP_PASSWORD` (será solicitado ao usuário; envio fica em try/catch não bloqueante).
   - `verify_jwt = false` em `supabase/config.toml`.
2. **`lookup-by-cpf`** — porta direta:
   - Recebe CPF, valida dígitos, retorna último anexo daquele CPF para auto-preencher o formulário.
   - `verify_jwt = false`.

### Rotas e UI

Novas rotas (em `src/App.tsx`):

| Rota | Acesso | Componente |
|------|--------|------------|
| `/assinar` | Público | `<LegalAnnexFlow documentType="anexo" />` |
| `/assinar-experimental` | Público | `<LegalAnnexFlow documentType="experimental" />` |
| `/anexos` | Admin (via `ProtectedRoute` + role check) | `<AnexosJuridicos />` |

Componentes a criar em `src/components/legal-annex/` (portados):
- `ProgressBar`, `StudentDataForm` (com auto-preenchimento por CPF), `TermsScroller`, `MedicalEvaluation`, `ImageAuthorization`, `SignaturePad`, `LegalPulse`.

Páginas:
- `src/pages/LegalAnnexFlow.tsx` — fluxo de 5 etapas (idêntico ao original, ajustado para o design system Fortem dark).
- `src/pages/AnexosJuridicos.tsx` — painel admin (tabela, filtros por status médico/imagem/tipo, busca por nome/CPF, modal de detalhes, exclusão).
- `src/components/legal-annex/AnnexDetailModal.tsx` — visualização completa + impressão.

Sidebar (`src/components/AppSidebar.tsx`):
- Adicionar item `{ title: "Anexos Jurídicos", url: "/anexos", icon: FileSignature }` em `cadastrosAdminItems`.

Ficha do aluno (`src/components/student/StudentSummary.tsx` ou similar):
- Painel discreto exibindo: status do anexo (Regular/Vencido/Não assinado), data de assinatura, link "Ver completo" abrindo o `AnnexDetailModal`.

### Design

- Reusar tokens já existentes do Fortem (dark theme, primary verde). Substituir as classes `card-shadow` / `legal-text` do projeto original por equivalentes via `@layer components` em `src/index.css` (adicionar somente o que faltar).
- Asset `fortem-logo-red.png` será copiado de Consent & Care para `src/assets/`.

### Secret necessário

`GMAIL_APP_PASSWORD` (Gmail SMTP em `contatofortem@gmail.com`). Será solicitado via `add_secret` após aprovação do plano. O envio do email é não-bloqueante: o anexo grava mesmo se o email falhar.

### Fora do escopo (intencional)

- Geração de link único com token por aluno (rejeitado nas perguntas: rotas continuam públicas).
- Criação automática de Lead se CPF não bater (rejeitado: vincula só se já existir).
- Acesso de Coordenador ao painel (rejeitado: somente Admin).

### Ordem de execução

1. Migration (DB + bucket + trigger de vinculação por CPF).
2. Solicitar secret `GMAIL_APP_PASSWORD`.
3. Copiar asset + criar componentes da pasta `legal-annex/`.
4. Criar páginas e rotas; adicionar item na sidebar.
5. Deploy automático das edge functions.
6. QA: assinar fluxo padrão e experimental, conferir vinculação ao aluno, abrir painel admin.
