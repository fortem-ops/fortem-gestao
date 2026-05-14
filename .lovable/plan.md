# Tolerância CLT no Módulo Ponto

Implementa a regra brasileira de tolerância (5 min por marcação, 10 min/dia) com cálculo automático, status, alertas e relatórios — sem intervenção manual.

## 1. Banco de dados (migração)

### 1.1 Novos campos em `ponto_jornadas`
- `prev_entrada`, `prev_intervalo_inicio`, `prev_intervalo_fim`, `prev_saida` (timestamptz) — preenchidos automaticamente a partir de `ponto_horarios_professor` quando a jornada é aberta.
- `divergencia_entrada_min`, `divergencia_intervalo_inicio_min`, `divergencia_intervalo_fim_min`, `divergencia_saida_min` (int, sinalizado: negativo = antes, positivo = depois).
- `minutos_tolerados` (int) — soma das divergências dentro da regra.
- `minutos_considerados` (int) — soma efetiva para desconto/extras.
- `divergencia_total_dia` (int) — |soma| de todas as divergências.
- `tolerancia_excedida` (boolean) — true quando soma > 10 ou alguma marcação > 5.
- `minutos_extras_validos` (int), `minutos_descontaveis` (int).
- `status_ponto` (novo enum `ponto_status_dia`):
  `dentro_tolerancia | divergencia_leve | divergencia_considerada | banco_negativo | hora_extra | jornada_incompleta | falta_marcacao | em_analise`.

### 1.2 Configuração
Adicionar em `ponto_configuracoes`:
- `tolerancia_marcacao_min` (default 5)
- `tolerancia_diaria_min` (default 10)
(`tolerancia_min` existente fica como fallback/legado.)

### 1.3 Tabela de eventos do banco de horas
Já existe `ponto_banco_horas`. Adicionar `origem text` (`tolerancia_excedida | hora_extra | ajuste_manual | feriado`) e `jornada_id uuid` para rastrear o lançamento.

### 1.4 Funções SQL
- `fn_ponto_calcular_divergencias(_jornada_id uuid)` — núcleo da regra:
  1. Carrega previsto (`ponto_horarios_professor` do dia da semana) e realizado.
  2. Calcula 4 divergências em minutos.
  3. Soma absolutos → `divergencia_total_dia`.
  4. Aplica regra: se qualquer marcação > tolerância OU soma > tolerância diária ⇒ `tolerancia_excedida = true`, `minutos_considerados = soma negativa`, `minutos_extras_validos = soma positiva`. Caso contrário `minutos_tolerados = soma`, considerados = 0.
  5. Define `status_ponto`.
  6. Persiste em `ponto_jornadas`.
- Trigger `trg_ponto_recalcular` AFTER INSERT/UPDATE em `ponto_jornadas` (campos de horário) chama a função.
- `fn_ponto_consolidar_banco(_jornada_id)` — grava em `ponto_banco_horas` minutos descontáveis (negativos) e extras (positivos) somente quando `status = encerrada` e `tolerancia_excedida = true` (ou hora extra confirmada).
- Atualizar `fn_ponto_calcular_fechamento` para agregar `minutos_extras_validos`, `minutos_descontaveis`, contagem de status por categoria, e gravar em novos campos do fechamento (`atrasos_count`, `faltas_marcacao_count`, `jornadas_incompletas_count`).
- `fn_ponto_dashboard_coordenador` ampliado para devolver: total atrasos no mês, minutos negativos, horas extras, top 5 funcionários com maior recorrência, faltas, jornadas incompletas, ranking de pontualidade.
- `fn_ponto_alertas_atrasos()` — roda diariamente, gera notificações quando >3 atrasos na semana ou >5 no mês, falta de marcação obrigatória ou jornada incompleta. Usa tabela `notificacoes` existente.

## 2. Backend (edge / agendamento)
- Cron (pg_cron) diário 23:50 → roda `fn_ponto_alertas_atrasos` e força recálculo das jornadas do dia.
- Mantém fechamento mensal já existente; passa a respeitar novos contadores.

## 3. Frontend

### 3.1 Helpers
`src/lib/pontoTolerancia.ts`:
- `calculateTolerance(diff, cfg)`
- `calculateDailyDeviation(jornada)`
- `validateLegalTolerance(jornada, cfg)`
- `calculateBankHours(jornada)`
- `STATUS_PONTO_LABEL`, `STATUS_PONTO_COLOR` (mapeia para tokens semânticos `success/warning/destructive/info`).

### 3.2 Componentes atualizados
- `ResumoDoDia.tsx`: nova seção "Cálculo do dia" com previsto vs realizado por marcação, divergência (com cor), badge de status, tooltip explicando a regra aplicada (ex.: "4 min ignorados pela tolerância CLT").
- `StatusJornadaCard.tsx`: adiciona badge `status_ponto`.
- `HistoricoJornadas.tsx`: coluna divergência (amarelo ≤5 min, vermelho >5 ou dia excedido, verde extras válidas), coluna saldo do dia.
- `MeuRelatorioPonto.tsx` / `MeuBancoHoras.tsx`: usar novos campos.
- `EquipeAoVivoTable.tsx`: indicador de atraso/tolerância em tempo real.
- `FechamentoMensalTable.tsx`: colunas atrasos, descontos, extras válidas, faltas, jornadas incompletas.
- Dashboard coordenador (`PontoWidget` + nova seção em `PontoEquipe`): cards com total atrasos, minutos negativos, horas extras, ranking pontualidade, recorrentes.

### 3.3 Relatórios
`src/lib/relatorioPontoExport.ts` ampliado:
- Colunas: previsto, realizado, divergência por marcação, tolerados, considerados, extras válidos, saldo, status.
- PDF (novo) via jsPDF + autotable; mantém XLSX/CSV existentes.

## 4. Critérios de aceite (exemplos do enunciado)
- 08:04 entrada / 16:56 saída → status `dentro_tolerancia`, considerados = 0.
- 08:06 entrada / 17:00 saída → divergência 6 min > 5 ⇒ considerados = 6, status `divergencia_considerada`, banco −6.
- 08:05 + 13:06 (soma 11) → soma > 10 ⇒ todos os 11 min considerados, banco −11, status `banco_negativo`.
- Hora extra: 17:04 saída ignorada; 17:06 ⇒ +6 min banco positivo, status `hora_extra`.

## 5. Detalhes técnicos

```text
divergência por marcação = realizado - previsto   (em minutos, signed)
soma_dia = Σ |divergência|
se max(|divergência|) > 5  OR  soma_dia > 10:
    tolerancia_excedida = true
    descontaveis = Σ divergência onde resultado é "atraso"/"saída antecipada"
    extras       = Σ divergência onde resultado é "antecipa entrada" / "saída posterior"
senão:
    tolerados = soma_dia ; descontaveis = extras = 0
```

- Funções SQL: `SECURITY DEFINER`, `SET search_path = public`.
- Trigger idempotente (recalcula sempre).
- RLS já existente nas tabelas é mantida.
- Apenas coordenador/admin vê campos agregados de equipe (já garantido por `is_coordinator_or_admin`).

## Fora de escopo desta entrega
- Configuração por colaborador de tolerância customizada (usa configuração global).
- Política de compensação de banco de horas (apenas registro).
- Integração com folha externa (somente exportação).
