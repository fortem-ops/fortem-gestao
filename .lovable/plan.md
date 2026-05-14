## Próximos passos do módulo Ponto

Três entregas em paralelo, todas conectadas à lógica de tolerância CLT já implantada (5 min/marcação, 10 min/dia, status automáticos em `ponto_jornadas`).

---

### 1. Dashboard do Coordenador (`/ponto/equipe` aprimorado)

Hoje a página só mostra a tabela "Equipe ao vivo". Vamos transformá-la em um painel completo com filtros e KPIs do dia/semana/mês.

**Cards de KPI no topo** (consulta a `ponto_jornadas` agregada por período):
- Profissionais em jornada agora / em intervalo / pendentes
- Total de divergências consideradas hoje (minutos)
- Banco de horas líquido da equipe (mês corrente)
- Nº de jornadas com `tolerancia_excedida = true` no mês
- Top 5 atrasos recorrentes (ranking por usuário, últimos 30 dias)

**Filtros**: período (hoje / semana / mês / custom), profissional, status (`status_ponto`).

**Seções**:
- `EquipeAoVivoTable` (mantida)
- Nova `RankingDivergenciasTable` — usuários ordenados por minutos descontáveis no período
- Nova `AlertasPontoPanel` — lista os alertas gerados pelo cron (ver item 3)

**Backend**: criar função SQL `fn_ponto_dashboard_coordenador(p_inicio date, p_fim date)` retornando JSON com os agregados, para evitar múltiplos round-trips.

---

### 2. Exportações em PDF

Adicionar PDF ao menu já existente `ExportarRelatorioMenu` (que hoje exporta CSV/XLSX). Stack: **jsPDF + jspdf-autotable** (leve, sem dependência de servidor).

**Três relatórios PDF**:

a) **Espelho de ponto individual** (em `/ponto/relatorio` e no `MeuRelatorioPonto`)
  - Cabeçalho: logo Fortem, nome do colaborador, CPF (se houver), período
  - Tabela diária: data, prev. entrada, marcações reais, divergências (entrada/intervalo/saída), minutos tolerados, minutos considerados, status, banco do dia
  - Rodapé: totais do período, saldo banco de horas, assinatura colaborador / coordenador
  - Nota legal: "Cálculo conforme art. 58 §1º da CLT — tolerância 5 min/marcação, 10 min/dia"

b) **Fechamento mensal da equipe** (em `/ponto/fechamento`)
  - Uma linha por profissional com totais do mês: horas previstas, trabalhadas, extras válidas, descontáveis, saldo banco
  - Marca de "Aprovado por … em …" quando fechado

c) **Relatório de divergências** (novo, no dashboard coordenador)
  - Lista jornadas com `tolerancia_excedida = true` no período, agrupadas por profissional

**Implementação**:
- Novo helper `src/lib/pontoPdf.ts` com funções `gerarEspelhoPonto`, `gerarFechamentoMensal`, `gerarRelatorioDivergencias`
- Cores e tipografia seguindo design tokens (verde primary, status mapeados via `STATUS_PONTO_LABEL`)
- Atualizar `ExportarRelatorioMenu` adicionando item "PDF" com ícone `FileDown`

---

### 3. Alertas via Cron

Job diário às 23:50 que consolida o dia e gera notificações para coordenadores.

**Migração SQL**:
- Função `fn_ponto_alertas_diarios()` que:
  1. Para cada jornada de hoje com `tolerancia_excedida = true` ou `status_ponto IN ('banco_negativo','jornada_incompleta','falta_marcacao')` cria uma linha em `notificacoes` (categoria `ponto`, prioridade conforme severidade) com destinatários = todos coordenadores/admins (via `user_roles`).
  2. Recalcula jornadas abertas que não foram fechadas (chama `fn_ponto_calcular_divergencias`).
  3. Registra resumo em `audit_log`.

**Edge function** `ponto-alertas-diarios` (thin wrapper que invoca a função SQL via service role) — necessária porque `pg_cron` + `pg_net` exige uma URL HTTP.

**Agendamento** (via insert tool, não migration):
```sql
select cron.schedule('ponto-alertas-diarios', '50 23 * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/ponto-alertas-diarios',
    headers := '{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
```

**Pré-requisito**: habilitar extensões `pg_cron` e `pg_net` (migration).

**UI**: o painel `AlertasPontoPanel` (item 1) lê `notificacoes` filtrando `categoria = 'ponto'` dos últimos 7 dias.

---

### Ordem de execução

1. Migration: extensões + `fn_ponto_dashboard_coordenador` + `fn_ponto_alertas_diarios`
2. Edge function `ponto-alertas-diarios` + agendamento cron (insert)
3. Frontend dashboard coordenador (KPIs, ranking, painel de alertas)
4. Helper `pontoPdf.ts` + dependências (`jspdf`, `jspdf-autotable`) + integração no menu de exportação

### Fora do escopo

- Envio de WhatsApp/email dos alertas (apenas notificação interna)
- Aprovação digital com assinatura no PDF (apenas espaço para assinatura impressa)
- Dashboard do colaborador (foco aqui é coordenador)
