# Pix Automático Banco Inter — Jornada 1 (Escopo confirmado)

## 1. Banco de dados (1 migração)

Criar 3 tabelas:

- **`inter_tokens`** — cache do OAuth2 do Inter (`access_token`, `expires_at`, `scope`). RLS ligada, sem policies; acesso apenas via `service_role` nas Edge Functions.
- **`pix_recorrencias`** — `aluno_id`, `id_rec` (único), `id_solic_rec`, `status` (`CRIADA`/`AGUARDANDO_AUTORIZACAO`/`AUTORIZADA`/`CANCELADA`/`REJEITADA`), `valor_minimo`, `periodicidade` (MENSAL), `data_inicio`, `data_fim`, `politica_retentativa` (PERMITE_3R_7D), `motivo_cancelamento`, `raw_response`.
- **`pix_cobrancas`** — `id_rec`, `aluno_id`, `txid` (único), `valor`, `data_vencimento`, `status` (`CRIADA`/`AGENDADA`/`LIQUIDADA`/`REJEITADA`/`CANCELADA`), `descricao`, `pagamento_id` (FK opcional para `pagamentos`), `motivo_rejeicao`, `liquidado_em`, `raw_response`.

GRANTs para `authenticated` + `service_role` nas tabelas Pix; RLS com policies restringindo SELECT/INSERT/UPDATE/DELETE a `admin` ou `coordenador` via `has_role`. Triggers de `updated_at` e índices em `aluno_id`, `id_rec`, `txid`, `status`.

## 2. Edge Functions

Helper compartilhado em `supabase/functions/_shared/inter.ts`:
- `getInterToken()` — lê o token mais recente em `inter_tokens` (margem 60s); se expirado, chama `/oauth/v2/token` (client_credentials + escopos Pix Automático) com mTLS via `Deno.createHttpClient({ cert, key })` usando `INTER_CERT_PEM`/`INTER_KEY_PEM`, persiste e retorna.
- `interFetch(path, init)` — injeta `Authorization: Bearer`, `x-conta-corrente: INTER_CONTA_CORRENTE`, base = `INTER_BASE_URL`, com mTLS client.
- `requireAdminOrCoord(req)` — valida JWT do chamador e checa papel em `user_roles`.
- `genTxid()` — UUID sem traços (32 chars alfanum).

Funções:

1. **`inter-auth`** — POST `/oauth/v2/token`; reaproveita token válido; retorna `{ access_token, expires_at }`.
2. **`pix-criar-recorrencia`** — `{ aluno_id, valor_minimo, data_inicio, data_fim }` → busca CPF/nome do aluno → POST `/rec` com `vinculo`, `calendario`, `valor.valorMinimoRecebedor`, `politicaRetentativa: PERMITE_3R_7D`, `periodicidade: MENSAL`. Persiste em `pix_recorrencias` (status `CRIADA`).
3. **`pix-solicitar-confirmacao`** — `{ idRec }` → POST `/solicrec` com devedor. Atualiza `status = AGUARDANDO_AUTORIZACAO`, grava `id_solic_rec`.
4. **`pix-criar-cobranca`** — `{ idRec, valor, dataVencimento, descricao }` → valida `status = AUTORIZADA` → gera `txid` → PUT `/cobr/{txid}` com `calendario`, `devedor`, `valor`, `idRec`, `solicitacaoPagador`. Persiste em `pix_cobrancas`.
5. **`pix-cancelar-recorrencia`** — `{ idRec, motivo? }` → PATCH `/rec/{idRec}` com `status: CANCELADA`. Atualiza tabela.
6. **`pix-webhook`** — público (sem JWT). Processa eventos `REC_AUTORIZADA`, `REC_CANCELADA`, `COBR_LIQUIDADA`, `COBR_REJEITADA`; em `COBR_LIQUIDADA` cria linha em `pagamentos` e vincula via `pagamento_id`; em `COBR_LIQUIDADA`/`COBR_REJEITADA` cria notificação interna para todos os admins (categoria `financeiro`, tipo `simples`, prioridade `alta`) via `notificacoes` + `notificacao_destinatarios`.

## 3. Frontend

- Adicionar `<TabsTrigger value="financeiro">Financeiro</TabsTrigger>` em `src/pages/StudentProfile.tsx` (após "Plano/Serviços").
- `src/components/student/StudentFinanceiro.tsx` — wrapper da aba (já preparado para receber novas seções).
- `src/components/student/financeiro/PixAutomaticoSection.tsx`:
  - Query da recorrência mais recente do aluno + badge colorido por status.
  - **Ativar Pix Automático** (quando não existe ativa) → `AtivarPixDialog` (valor mínimo, data início/fim) → chama `pix-criar-recorrencia` e em seguida `pix-solicitar-confirmacao`; mostra a mensagem de instrução sobre autorização no app do banco.
  - **Gerar Cobrança do Mês** (só com status `AUTORIZADA`) → `GerarCobrancaDialog` (valor, vencimento, descrição) → `pix-criar-cobranca`.
  - **Histórico de cobranças** com status (LIQUIDADA/REJEITADA/AGENDADA/CANCELADA/CRIADA) e valor formatado em BRL.
  - **Cancelar Pix Automático** com `AlertDialog` → `pix-cancelar-recorrencia`.
  - Realtime subscribe em `pix_recorrencias` e `pix_cobrancas` do aluno para refletir webhooks.

## 4. Notificações internas

No `pix-webhook`, ao processar `COBR_LIQUIDADA` ou `COBR_REJEITADA`, inserir uma linha em `notificacoes` (titulo descritivo, descricao com aluno/valor/txid, categoria `financeiro`, tipo `simples`, prioridade `alta`, `aluno_id`) e popular `notificacao_destinatarios` com todos os `user_id` cujo papel é `admin`. Professor/coordenador ficam de fora conforme combinado.

## 5. Pós-deploy

Após o deploy, registrar o webhook no Inter via `PUT /webhookrec` e `PUT /webhookcobr` apontando para a URL pública de `pix-webhook`. Vou entregar o comando `curl` pronto com a URL correta do projeto ao final.

## Notas técnicas

- mTLS no Supabase Edge Runtime: `Deno.createHttpClient({ cert, key })` passado como `client` no `fetch`.
- Reuso de token: select em `inter_tokens` com `expires_at > now()+60s`; respeita o rate limit (120/min).
- `txid`: `crypto.randomUUID().replace(/-/g,'')` → 32 chars alfanuméricos.
- Nenhuma credencial do Inter é exposta ao frontend — todas as chamadas passam pelas Edge Functions.
- `supabase/config.toml`: não precisa de override (default `verify_jwt = false`); autorização é validada em código.
- Tipos do Supabase serão regenerados automaticamente após a migração.

## Fora do escopo (confirmado)

- Exportação de relatório financeiro Pix — depois.
- Retentativa manual de cobrança rejeitada — depois.
- Notificação a professor/coordenador — fora; só admin.
