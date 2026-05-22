
# 📊 Módulo Relatórios — Plano de Implementação

Entrega completa em uma só leva, dividida em camadas (banco → backend/views → UI). Tudo integrado ao schema existente; nada é duplicado, exceto o novo subsistema financeiro de parcelas (necessário para inadimplência).

---

## 1. Banco de dados (uma migração)

### 1.1 Financeiro — novo subsistema
- `pagamentos` — uma linha por venda/contrato (header).
  - venda_id, aluno_id, plano_id, valor_total, forma_pagamento_id, parcelas_qtd, status (`em_dia | parcial | vencido | quitado | cancelado`).
- `pagamento_parcelas` — uma linha por parcela.
  - pagamento_id, numero, valor, vencimento, data_pagamento, status (`aberto | pago | vencido | cancelado`), forma_pagamento_id, comprovante_url.
- `cobranca_tentativas` — log de tentativas de cobrança (parcela_id, canal, resultado, data).
- Trigger que recalcula `pagamentos.status` quando uma parcela muda.
- Trigger diário (cron) que marca parcelas `aberto` com `vencimento < hoje` como `vencido`.
- Backfill: gera 1 parcela `paga` por venda histórica para não quebrar relatórios.

### 1.2 Cancelamentos — campo obrigatório de motivo
- Tabela `cancelamento_motivos` (catálogo: financeiro, mudança de rotina, lesão, mudança de cidade, falta de tempo, insatisfação, migração Wellhub/TotalPass, outros).
- `vendas_planos` (cancelamentos): adicionar `motivo_cancelamento_id` (NOT NULL quando `status = cancelado`, via trigger) e `observacao_cancelamento`.
- Atualizar `StudentPlan.tsx → Cancelar Contrato` para exigir motivo.

### 1.3 Insights / alertas de relatórios
- `relatorios_insights` — cards "Insights da Semana" (titulo, descricao, severidade, payload, periodo, gerado_em).
- `relatorios_alertas_config` — limites configuráveis (queda de vendas %, ocupação mínima, dias de atraso, etc.).

### 1.4 Views (read-only, performáticas)
Criadas em `public` com RLS herdada via `security_invoker = on`:
- `v_vendas_resumo` (mês, profissional, plano, origem, frequencia, valor, qtd).
- `v_funil_conversao` (lead → prospect → aluno, por origem/profissional/período).
- `v_financeiro_recebimentos` (parcelas pagas).
- `v_financeiro_aberto` / `v_financeiro_vencidos` (com dias de atraso e ranking).
- `v_planos_base` (ativos, licença, churn, LTV, tempo médio).
- `v_cancelamentos` (motivo, profissional, tempo até cancelar).
- `v_servicos_agenda` (agendamentos, comparecimento, no-show, ocupação por hora/profissional/atividade).
- `v_crm_pipeline` (etapas, tempo médio, perdas).
- `v_tecnico_alertas` (avaliações vencidas, treinos desatualizados pela regra 1x=12sem / 2x=8sem / 3x=6sem).
- `v_equipe_produtividade` (atendimentos, horas, conversão, tarefas, avaliações).

### 1.5 Materialized views (KPIs pesados)
- `mv_kpis_vendas_mensal`, `mv_kpis_financeiro_mensal`, `mv_ocupacao_agenda_diaria`.
- Função `refresh_relatorios_mvs()` + cron a cada 30 min via `pg_cron + pg_net`.

### 1.6 Funções auxiliares
- `get_periodo_vendas(p_inicio, p_fim, p_filtros jsonb)` etc., para que o frontend não monte SQL pesado.
- `gerar_insights_semana()` (cron semanal) que popula `relatorios_insights`.

### 1.7 RLS
- Todas as views/tabelas reutilizam `is_admin`, `is_coordinator_or_admin`.
- Para Professor/Nutri/Fisio: usar `responsavel_id = auth.uid()` nas views, filtrando linha a linha (segurança em camada de dados, não só de UI).

---

## 2. Backend — Edge Functions

- `relatorios-export` — recebe `{ tipo, filtros, formato: 'pdf'|'xlsx'|'csv' }`, retorna arquivo. Usa `xlsx` (npm) para Excel, `pdf-lib` para PDF premium (cabeçalho FORTEM vermelho/preto), `csv-stringify` para CSV.
- `relatorios-alertas-diarios` — varre limites de `relatorios_alertas_config`, dispara notificações via sistema existente (`notify-notificacao-evento`) para coordenadores/admin.
- Cron diário 07:00 para alertas; cron semanal segunda 06:00 para insights; cron 30 min para refresh MVs.

---

## 3. Frontend

### 3.1 Navegação
- Novo grupo "Relatórios" na sidebar (`AppSidebar.tsx`) entre "Técnico" e "Cadastros", com ícone `BarChart3`.
- Itens: Vendas, Financeiro, Planos, Cancelamentos, Serviços, CRM, Técnico, Equipe, Insights.
- Visibilidade conforme RBAC (Professor vê só Equipe + seus dados; Coord/Admin veem tudo).

### 3.2 Rotas (todas `lazy`)
```
/relatorios                → RelatoriosHome (KPIs gerais + Insights da Semana)
/relatorios/vendas
/relatorios/financeiro     (+ subabas: Recebidos / Em Aberto / Vencidos / Fluxo)
/relatorios/planos
/relatorios/cancelamentos
/relatorios/servicos
/relatorios/crm
/relatorios/tecnicos
/relatorios/equipe
```

### 3.3 Componentes compartilhados (`src/components/relatorios/`)
- `RelatoriosLayout.tsx` — sidebar interna + header com filtros globais.
- `GlobalFilters.tsx` — período (preset + custom), aluno, profissional, plano, unidade, status, origem; persiste em URL (`useSearchParams`) e em `localStorage`.
- `KpiCard.tsx`, `KpiGrid.tsx`.
- `ChartBar`, `ChartLine`, `ChartPie`, `ChartHeatmap` (wrappers Recharts já no projeto).
- `ReportTable.tsx` — paginação server-side, busca, ordenação.
- `ExportMenu.tsx` — botão "Exportar" → PDF / Excel / CSV via edge function.
- `InsightCard.tsx`.

### 3.4 Páginas (uma por categoria) — padrão
1. KPIs no topo (cards).
2. 2–3 gráficos interativos.
3. Tabela detalhada com busca e exportação.
4. Filtros laterais (no desktop) / drawer (mobile).
5. Responsivo: grid colapsa para 1 coluna < md.

### 3.5 Integração com Cancelamento
- Atualizar `StudentPlan.tsx` (Cancelar Contrato + Agendar Cancelamento já existentes) para incluir `<Select>` obrigatório de motivo + `<Textarea>` opcional.

---

## 4. Design

- Segue tokens existentes (dark, primary vermelho FORTEM, cinza/preto). Apenas adicionar `--chart-1..5` ajustados para vermelho/cinza no `index.css` se faltarem.
- Cards usam `glass-card`; KPIs usam ícones Lucide; gráficos com tema escuro.
- Sem cores hardcoded em componentes.

---

## 5. Permissões (resumo)

| Perfil | Vê |
|---|---|
| Professor | Equipe (próprios dados), Serviços/Vendas filtrados por `responsavel_id`, Técnico dos seus alunos |
| Nutri/Fisio | Serviços e Equipe filtrados pelos próprios atendimentos |
| Coordenador | Tudo, exceto config de alertas |
| Admin | Tudo + config de alertas/insights |

Aplicado **nas views/RLS** (segurança real) e refletido no menu.

---

## 6. Ordem de execução

1. Migração schema (financeiro, motivos, views, MVs, RLS, cron).
2. Backfill de parcelas históricas + insights iniciais.
3. Edge functions (`relatorios-export`, `relatorios-alertas-diarios`).
4. Sidebar + rotas + layout + filtros globais + componentes base.
5. Páginas: Vendas → Financeiro → Planos → Cancelamentos → Serviços → CRM → Técnicos → Equipe → Home/Insights.
6. Ajuste em `StudentPlan.tsx` para motivo de cancelamento.
7. Linter Supabase + verificação de RLS.

---

## 7. Detalhes técnicos relevantes (para revisão)

- Pagamentos: usar `numeric(12,2)`, índices em `(status, vencimento)` e `(aluno_id, status)`.
- MV refresh: `REFRESH MATERIALIZED VIEW CONCURRENTLY` (exige índice único).
- Exportações grandes (>5k linhas) usam streaming na edge function.
- Heatmap de agenda agregado em SQL (não no client).
- Insights gerados por SQL simples comparando MV mês atual × anterior; sem IA.
- Nada usa `localStorage` para checar role — sempre via RPC `is_admin` / `is_coordinator_or_admin`.

Ao aprovar, executo na ordem acima — a migração é grande e virá em um único arquivo SQL para revisão.
