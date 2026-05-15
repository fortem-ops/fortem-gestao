## Objetivo

Planos do tipo **Start**, **Gympass/Wellhub** e **Total Pass** passam a ser sempre "Renovação automática mensal". Todo mês o sistema gera automaticamente uma nova mensalidade no histórico de vendas. A renovação só pode ser interrompida pelo cancelamento manual do contrato.

---

## 1. Banco de dados (migração)

Em `planos`:
- Adicionar `renovacao_automatica boolean NOT NULL DEFAULT false`
- Adicionar `proxima_renovacao date` — data da próxima cobrança
- Trigger `BEFORE INSERT/UPDATE OF tipo, data_inicio` em `planos` que:
  - Define `renovacao_automatica = true` quando `tipo` ∈ {Start, Gympass/Wellhub, Total Pass}
  - Inicializa `proxima_renovacao = data_inicio + 1 mês` se nulo

Em `vendas`:
- Adicionar `origem text NOT NULL DEFAULT 'manual'` (valores: `manual`, `renovacao_automatica`) — para diferenciar mensalidades geradas pelo sistema das vendas humanas no histórico

Backfill:
- `UPDATE planos SET renovacao_automatica=true, proxima_renovacao = (data_inicio + interval '1 month')::date WHERE ativo AND tipo IN ('Start','Gympass/Wellhub','Total Pass') AND proxima_renovacao IS NULL`

Cancelamento manual já zera `ativo=false`; basta também marcar `renovacao_automatica=false` no UPDATE feito por `handleCancelContract`.

---

## 2. Edge function + cron

Criar `supabase/functions/renovar-planos-mensais/index.ts`:
- Busca todos `planos` com `ativo=true`, `renovacao_automatica=true`, `proxima_renovacao <= CURRENT_DATE`
- Para cada um, em loop:
  1. `INSERT INTO vendas` com `tipo='plano'`, `catalogo_id=plano.id` (ou null), `nome_snapshot=plano.tipo`, `valor=plano.valor`, `status_pagamento='pendente'`, `origem='renovacao_automatica'`, `plano_id=plano.id`, `data_venda=CURRENT_DATE`
  2. `UPDATE planos SET proxima_renovacao = proxima_renovacao + interval '1 month' WHERE id=...` (loop até ficar > hoje, caso a função fique parada por dias)
- Retorna JSON com contagem.

Agendar via `pg_cron` (diariamente às 03:00 BRT) chamando a função via `pg_net.http_post`.

---

## 3. UI — `src/components/student/StudentPlan.tsx`

- Substituir o lookup `isAutoRenewPlan(data.tipo)` pelo campo `data.renovacao_automatica` para exibir o badge "Renovação automática mensal".
- No diálogo "Editar Plano", **não** permitir alternar `renovacao_automatica` manualmente — texto informativo: *"Esta opção só é alterada via cancelamento de contrato."*
- Em `handleCancelContract`: incluir `renovacao_automatica: false` no `UPDATE`.
- Mostrar `Próxima renovação` (data) no card quando `renovacao_automatica=true`.

---

## 4. Histórico de vendas — `HistoricoVendas.tsx`

- Adicionar uma tag visual (`Badge` "Renovação automática") quando `venda.origem === 'renovacao_automatica'`.

---

## Detalhes técnicos

- Tipos auto-renováveis ficam centralizados no trigger SQL e na constante `isAutoRenewPlan` (já existente em `src/lib/planTipo.ts`) — manter as duas listas alinhadas.
- A função roda diariamente; usa um loop `while proxima_renovacao <= today` para recuperar de paradas.
- Não altera regras de crédito — apenas registra a mensalidade financeira.
- Sem mudanças em RLS (insert da função roda com service_role).

---

## Fora de escopo

- Cobrança real / integração com gateway de pagamento.
- Notificação ao aluno sobre nova mensalidade.
- Recalcular mensalidades retroativas para planos antigos sem `proxima_renovacao` (o backfill cobre os ativos).
