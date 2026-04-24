
## Objetivo
Adicionar o módulo **Clube FORTEM** como camada de benefícios sobre os cadastros existentes. MVP funcional: carteirinha digital com QR rotativo, painel de parceiros com scanner, motor de validação automática, dashboard estratégico. Sem duplicar `alunos`, `planos` ou `responsaveis`.

## Banco de dados (migrations)

### Enums novos
- `clube_status_membro`: `ativo | bloqueado | inadimplente | cancelado`
- `clube_nivel_membro`: `start | start_plus | power | pro | max`
- `parceiro_modo_validacao`: `qr_scan | cpf_manual | lista_nome`
- `beneficio_tipo`: `desconto_percentual | desconto_valor | gratuidade | vantagem_exclusiva | cashback_futuro`
- `beneficio_periodicidade`: `dia | semana | mes | livre`
- `uso_status_validacao`: `valido | recusado | expirado | bloqueado`
- `uso_origem_validacao`: `scanner | cpf_manual | admin`
- `regra_elegibilidade_tipo`: `plano | frequencia_minima | status_financeiro | tempo_matricula`

### Novas tabelas

**`clube_fortem_membros`** (1:1 com `alunos`)
- `id`, `aluno_id` (FK alunos, UNIQUE), `cpf_hash` (text, UNIQUE — sha256 do CPF), `status_membro` (enum, default `ativo`), `data_inicio`, `data_fim`, `nivel_membro` (enum, default `start`), `qr_secret` (text — segredo HMAC por membro), `ultimo_refresh_qr` (timestamptz), `fortem_id` (text UNIQUE — formato `FORTEM ID 000482`, gerado via sequence), `foto_url` (text, opcional), `aluno_desde` (date, default created_at), `created_at`, `updated_at`.

**`parceiros`**
- `id`, `nome`, `categoria`, `descricao`, `logo_url`, `responsavel_nome`, `responsavel_contato`, `email_login` (UNIQUE), `user_id` (FK auth.users, nullable — vínculo com conta de login), `ativo` (bool default true), `data_inicio_parceria`, `data_fim_parceria`, `modo_validacao` (enum default `qr_scan`), `pontuacao_engajamento` (int default 0), `latitude` (numeric, opcional para geolocalização), `longitude` (numeric, opcional), `created_at`, `updated_at`.
- **Sem `senha_hash`** — autenticação via Supabase Auth (campo `user_id`).

**`beneficios`**
- `id`, `parceiro_id` (FK), `titulo`, `descricao`, `tipo` (enum), `regra_uso` (text — ex.: "20% off acima de R$50"), `limite_por_periodo` (int), `periodicidade` (enum), `nivel_minimo` (enum nivel_membro default `start`), `ativo` (bool), `data_inicio`, `data_fim`, `created_at`, `updated_at`.

**`uso_beneficios`**
- `id`, `aluno_id` (FK), `cpf_hash`, `beneficio_id` (FK), `parceiro_id` (FK), `validado_por` (FK auth.users — usuário do parceiro que validou), `data_uso` (date), `hora_uso` (time), `status_validacao` (enum), `motivo_recusa` (text, nullable), `token_validacao` (text — token consumido), `origem_validacao` (enum), `created_at`.

**`regras_elegibilidade`**
- `id`, `beneficio_id` (FK), `tipo_regra` (enum), `valor_regra` (text — ex.: "30" para 30 dias, "ativo" para status), `ativo`, `created_at`, `updated_at`.

### Alterações em tabelas existentes
- Nenhuma. `clube_fortem_membros.aluno_id` referencia `alunos.id`. CPF fica só no hash (não vai para `alunos`).

### Índices
- `clube_fortem_membros(cpf_hash)`, `(aluno_id)`, `(fortem_id)`
- `uso_beneficios(aluno_id)`, `(parceiro_id)`, `(beneficio_id)`, `(data_uso)`
- `beneficios(parceiro_id)`, `(ativo)`
- `regras_elegibilidade(beneficio_id)`

### RLS

**`clube_fortem_membros`**
- SELECT autenticado (necessário para parceiros validarem após resolver token); UPDATE coord/admin; INSERT coord/admin; DELETE admin.

**`parceiros`**
- SELECT autenticado (alunos veem lista); INSERT/UPDATE/DELETE coord/admin OU `user_id = auth.uid()` (parceiro edita o próprio perfil exceto `ativo`/`pontuacao_engajamento`).

**`beneficios`**
- SELECT autenticado; INSERT/UPDATE coord/admin OU dono do parceiro (`parceiros.user_id = auth.uid()`); DELETE coord/admin.

**`uso_beneficios`**
- SELECT autenticado (aluno vê só os próprios via filtro client; parceiro vê os próprios; coord/admin vê tudo) — política: `aluno_id IN (SELECT id FROM alunos WHERE responsavel_id = auth.uid())` OR `validado_por = auth.uid()` OR `is_coordinator_or_admin(auth.uid())`.
- INSERT autenticado com `validado_por = auth.uid()`.
- Sem UPDATE/DELETE (registro imutável).

**`regras_elegibilidade`**
- SELECT autenticado; INSERT/UPDATE/DELETE coord/admin.

### Funções (SECURITY DEFINER)

**`fn_clube_hash_cpf(_cpf text) returns text`** — `encode(digest(regexp_replace(_cpf,'[^0-9]','','g'), 'sha256'), 'hex')`. Usa extensão `pgcrypto`.

**`fn_clube_generate_qr_token(_aluno_id uuid) returns jsonb`** — gera token HMAC com expiração 30s:
- Carrega `qr_secret` e `cpf_hash` do membro.
- Payload: `{aluno_id, cpf_hash, exp: now+30s, nonce}`.
- Token = base64url(payload) + "." + base64url(hmac_sha256(payload, qr_secret)).
- Atualiza `ultimo_refresh_qr`.
- Retorna `{token, expires_at, fortem_id, nivel_membro, status_membro}`.
- Verificação RLS: só o próprio aluno (via `responsavel_id`/auth) ou coord/admin pode chamar.

**`fn_clube_validar_token(_token text, _beneficio_id uuid) returns jsonb`** — motor de validação:
1. Decodifica token, verifica HMAC e expiração.
2. Resolve `aluno_id` via `cpf_hash`.
3. Checa status do membro (`ativo`?).
4. Checa benefício vigente (`ativo` + datas).
5. Checa nível compatível (`nivel_membro >= beneficio.nivel_minimo`).
6. Checa limite de uso no período (consulta `uso_beneficios` por `periodicidade`).
7. Avalia regras de elegibilidade (plano ativo, tempo de matrícula via `aluno_desde`, status financeiro via `planos.ativo`).
8. Se aprovado: insere em `uso_beneficios` com `status_validacao='valido'`, incrementa `parceiros.pontuacao_engajamento`, retorna sucesso + dados do aluno.
9. Se recusado: insere com `status_validacao='recusado'` + `motivo_recusa`, retorna falha.

**`fn_clube_sync_status_financeiro()`** — chamada por trigger em `planos`: marca `clube_fortem_membros.status_membro = 'inadimplente'` se nenhum plano ativo para o aluno; marca `'ativo'` quando volta a ter plano. Trigger AFTER INSERT/UPDATE em `planos`.

**`fn_clube_dashboard(_periodo_dias int default 30) returns jsonb`** — métricas: usos no período, ranking parceiros (top 5), alunos ativos no clube, taxa de ativação (membros / total alunos), benefício mais usado, uso por categoria.

### Triggers
- `update_updated_at_column` em todas as 5 novas tabelas.
- `fn_clube_sync_status_financeiro` em `planos` (AFTER INSERT/UPDATE).

### Sequence
- `clube_fortem_id_seq` para gerar `fortem_id` formatado (`FORTEM ID ${lpad(nextval, 6, '0')}`) via trigger BEFORE INSERT em `clube_fortem_membros`.

### Extensão
- Habilitar `pgcrypto` (para `digest` e `gen_random_bytes`).

## Frontend

### Novas rotas
- `/clube` → painel do aluno (carteirinha + lista de parceiros + histórico).
- `/parceiros/scanner` → painel do parceiro (login + scanner QR + validação).
- `/admin/clube` → gestão admin (membros, parceiros, benefícios, dashboard estratégico).

Adicionar item no `AppSidebar.tsx` com ícone `Sparkles` ("Clube FORTEM") visível para alunos/admin; rota de parceiro fica fora da sidebar (área separada).

### Componentes novos (`src/components/clube/`)
- **`MembershipCard.tsx`** — carteirinha digital wallet-style. Frente: header "CLUBE FORTEM", nome, badge de nível ("POWER MEMBER"), status (verde/vermelho), QR code grande dinâmico, FORTEM ID no rodapé. Verso (flip animation): foto, "Aluno desde", validade, status financeiro, categoria, contato, botão "Parceiros próximos", termos. Cores aplicadas conforme paleta por nível (start/start+/power/pro/max).
- **`MembershipQR.tsx`** — gera QR via `fn_clube_generate_qr_token`, refresh automático a cada 25s (antes da expiração de 30s), barra de progresso visual. Usa lib `qrcode.react`.
- **`PartnersList.tsx`** — lista de parceiros ativos com filtro por categoria, card com logo, nome, benefícios disponíveis para o nível do aluno. Botão favorito (localStorage).
- **`BenefitHistory.tsx`** — histórico de usos do aluno (data, parceiro, benefício, status).
- **`PartnerScanner.tsx`** — scanner QR via `html5-qrcode`. Após leitura: chama `fn_clube_validar_token`, mostra modal com nome do aluno, status, benefícios disponíveis, botão "VALIDAR". Resultado animado (check verde / X vermelho + motivo).
- **`PartnerManualValidation.tsx`** — fallback para validação manual por CPF (modo `cpf_manual`).
- **`AdminClubeDashboard.tsx`** — KPIs: usos no mês, ranking parceiros, alunos ativos, taxa ativação, benefício top, gráfico por categoria.
- **`AdminMembrosTable.tsx`** — listagem de membros com ações: ativar/bloquear/cancelar, alterar nível, reset QR secret.
- **`AdminParceirosTable.tsx`** — CRUD parceiros + criar conta de login (cria usuário Supabase Auth e vincula `parceiros.user_id`).
- **`AdminBeneficiosTable.tsx`** — CRUD benefícios com regras de elegibilidade aninhadas.

### Páginas
- **`src/pages/ClubeFortem.tsx`** — aluno: tabs "Carteirinha", "Parceiros", "Histórico". Estados visuais: ativo/bloqueado/inadimplente/cancelado.
- **`src/pages/ParceiroScanner.tsx`** — parceiro: login dedicado (Supabase Auth) + scanner. Layout standalone (sem sidebar do staff).
- **`src/pages/AdminClube.tsx`** — admin: tabs Dashboard, Membros, Parceiros, Benefícios.

### Integrações com telas existentes
- **`StudentProfile.tsx`** — nova aba "Clube FORTEM": status do membro, nível, FORTEM ID, botão "Ativar membro" (se ainda não tem). Coord/admin pode alterar nível e status.
- **`AddStudentDialog.tsx`** — campo opcional "CPF" (usado só para gerar `cpf_hash` ao ativar membro; não armazenado em `alunos`).
- **`Dashboard.tsx`** — novo widget `ClubeFortemWidget`: alunos ativos no clube, usos hoje, parceiro destaque do mês.

### Cores por nível (Tailwind tokens custom em `src/index.css` + helper)
```ts
// src/lib/clube.ts
export const NIVEL_THEME = {
  start: { bg: "#FFFFFF", text: "#111111", accent: "#E10600" },
  start_plus: { bg: "#F2F2F2", text: "#111111", accent: "#E10600" },
  power: { bg: "#6B6B6B", text: "#FFFFFF", accent: "#E10600" },
  pro: { bg: "#000000", text: "#FFFFFF", accent: "#E10600" },
  max: { bg: "#050505", text: "#FFFFFF", accent: "#FF2A2A", metallic: "#A6A6A6" },
};
```

### Permissões UI
- Aluno (logado): vê só própria carteirinha e benefícios.
- Parceiro (logado via `parceiros.user_id`): vê só scanner + histórico de validações próprias.
- Coord/Admin: gestão completa via `/admin/clube`.

### Dependências novas
- `qrcode.react` — geração QR na carteirinha.
- `html5-qrcode` — leitor de câmera no scanner.

## Wallet nativo (Apple/Google) — fora desta entrega
PWA com QR dinâmico web cobre o MVP. Geração de `.pkpass` (Apple Wallet) e Google Wallet API exigem certificado Apple Developer + chave Google Pay e ficam para fase 2.

## Geolocalização "parceiros próximos"
MVP usa apenas filtro por distância client-side via `navigator.geolocation` (campos `latitude/longitude` em `parceiros`). Notificações silenciosas e geofencing reais ficam para fase Wallet nativo.

## Fora de escopo (nesta entrega)
- Geração `.pkpass` / Google Wallet API.
- Notificações push baseadas em geolocalização.
- Cashback efetivo (campo `cashback_futuro` armazenado mas não processado).
- App separado de parceiros (usa mesma plataforma web).
- Avaliação de aluno sobre parceiro (entra na fase 2 da `pontuacao_engajamento`).

## Arquivos tocados
- Migration SQL única: enums, 5 tabelas, sequence, índices, funções, triggers, RLS, extensão pgcrypto.
- `src/pages/ClubeFortem.tsx` (novo).
- `src/pages/ParceiroScanner.tsx` (novo).
- `src/pages/AdminClube.tsx` (novo).
- `src/components/clube/*` (9 novos componentes listados acima).
- `src/components/dashboard/ClubeFortemWidget.tsx` (novo).
- `src/lib/clube.ts` (novo — helpers de tema, formatação, hash client-side).
- `src/components/AppSidebar.tsx` (item Clube FORTEM + item Admin > Clube).
- `src/App.tsx` (3 novas rotas, sendo `/parceiros/scanner` com layout próprio).
- `src/pages/StudentProfile.tsx` (aba "Clube FORTEM").
- `src/components/student/AddStudentDialog.tsx` + `StudentFormFields.tsx` (campo CPF opcional).
- `src/pages/Dashboard.tsx` (widget).
- `package.json` (`qrcode.react`, `html5-qrcode`).
