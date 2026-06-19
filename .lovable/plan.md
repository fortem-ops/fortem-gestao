# Integração Pipedrive ↔ Fortem — Fase 1

Importação one-way **Pipedrive → Fortem** de Persons + Deals como leads. Período de testes em paralelo; sync bidirecional fica para fase 2 quando o fluxo estiver validado.

## O que será entregue

### 1. Migration de banco
Adicionar rastreio de origem Pipedrive em `pipeline_metadata`:

```sql
ALTER TABLE public.pipeline_metadata
  ADD COLUMN pipedrive_person_id text,
  ADD COLUMN pipedrive_deal_id text,
  ADD COLUMN pipedrive_imported_at timestamptz;

CREATE UNIQUE INDEX pipeline_metadata_pipedrive_person_uniq
  ON public.pipeline_metadata (pipedrive_person_id)
  WHERE pipedrive_person_id IS NOT NULL;

CREATE UNIQUE INDEX pipeline_metadata_pipedrive_deal_uniq
  ON public.pipeline_metadata (pipedrive_deal_id)
  WHERE pipedrive_deal_id IS NOT NULL;
```

Garantir origem "Pipedrive" em `lead_origens` (insert idempotente).

### 2. Edge function `pipedrive-list-leads`
- Valida JWT do usuário e checa `has_role(uid, 'admin')` ou `'coordenador')`.
- Aceita filtros opcionais: `stageId`, `ownerId`, `since` (data), `limit`.
- Chama gateway: `GET /pipedrive/deals` (status=open) com Persons embutidas via `GET /pipedrive/persons/:id` em lote ou usando `/deals?...&include_fields`.
- Retorna lista normalizada: `{ dealId, personId, name, phone, email, ownerName, stageName, value, addedAt, alreadyImported: boolean }`.
  - `alreadyImported` = true quando `pipedrive_deal_id` ou `pipedrive_person_id` já existe em `pipeline_metadata`.

### 3. Edge function `pipedrive-import-leads`
- Mesma validação de role.
- Recebe `{ items: [{ dealId, personId, name, phone, email, responsavelId? }] }`.
- Para cada item, em transação lógica:
  1. Skip se `pipedrive_deal_id` já existir.
  2. Insere em `alunos` (nome, telefone, `current_pipeline_stage_id` = id de "Novo lead", `responsavel_id`).
  3. Insere `pipeline_metadata` com `origem_lead='Pipedrive'`, `pipedrive_person_id`, `pipedrive_deal_id`, `pipedrive_imported_at=now()`.
  4. Insere `pipeline_movements` registrando entrada no funil.
- Retorna `{ imported: n, skipped: n, errors: [...] }`.

### 4. Edge function `pipedrive-status`
- Chama `POST https://connector-gateway.lovable.dev/api/v1/verify_credentials` e retorna `{ outcome, latency_ms }` para a UI mostrar status verde/vermelho.

### 5. UI: nova aba "Integração Pipedrive" em `/admin`
Componente `src/components/admin/AdminPipedrive.tsx`:
- **Card de status**: badge verde/vermelho com latência (verify_credentials).
- **Filtros**: select de stage (carregado de `/pipedrive/stages`), select de owner (`/pipedrive/users`), date picker "desde", input limite.
- **Botão "Buscar leads"** → chama `pipedrive-list-leads` → tabela com checkbox por linha.
  - Colunas: nome, telefone, email, owner Pipedrive, stage Pipedrive, valor, data, status (já importado/novo).
  - Linhas "já importadas" ficam desabilitadas com badge cinza.
- **Mapeamento de responsável** (dropdown global acima da tabela): "Atribuir importados a → [select de profiles]". Opcional — se vazio, cai para o usuário logado.
- **Botão "Importar selecionados"** → confirm dialog → chama `pipedrive-import-leads` → toast com `{imported, skipped}` → invalida `["leads-list"]` no React Query.

Registrar aba em `src/pages/Admin.tsx` (visível só para admin).

### 6. Tipos e cliente compartilhado
- `src/lib/pipedrive.ts` com tipos `PipedriveLeadPreview`, `PipedriveImportResult` e wrappers `listPipedriveLeads()`, `importPipedriveLeads()`, `getPipedriveStatus()` usando `supabase.functions.invoke()`.

## Detalhes técnicos

- Todas as functions usam padrão CORS via `npm:@supabase/supabase-js@2/cors`, validam JWT lendo `Authorization` header, criam client com a anon key + token do user, e chamam `has_role` por RPC.
- Gateway: base `https://connector-gateway.lovable.dev/pipedrive`, headers `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${PIPEDRIVE_API_KEY}`. Ambas as variáveis já estão no projeto.
- Erros de gateway são propagados ao frontend com status + mensagem; sem retry direto na API Pipedrive.
- Paginação: a function usa `start` + `limit` do Pipedrive; UI pede no máximo 200 por busca (configurável).
- Sem schedule/cron nesta fase — só importação manual sob demanda.

## Fora de escopo (fase 2, quando validarmos)

- Espelhamento Fortem → Pipedrive (criar Person/Deal ao criar lead local, atualizar stage ao mover, marcar won/lost).
- Sync de Activities ↔ `tarefas`.
- Widget no dashboard com KPIs do Pipedrive.
- Webhook do Pipedrive para sync em tempo real.

## Validação ao final

- `verify_credentials` retorna `verified`.
- `pipedrive-list-leads` devolve ≥1 item com flags de duplicado corretas.
- Importar 1 lead cria registro em `alunos` + `pipeline_metadata` + `pipeline_movements`, aparece em `/leads`, e re-importar o mesmo é skipado.
