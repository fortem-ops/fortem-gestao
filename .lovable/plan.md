## Objetivo

1. Em **Ponto**, exibir e respeitar a **jornada de trabalho do dia** configurada em Admin Ponto (`ponto_horarios_professor`), em vez de só usar `carga_diaria_min` global.
2. Criar um novo módulo **Relatório Ponto** que lista as batidas com horários e informações adicionais (localização, dispositivo, observação), permite **ajuste manual** por Coordenadores/Administradores, **exportação de relatório** (CSV/XLSX) e **registro mensal (histórico)** consolidado.

---

## 1) Ponto puxa jornada do Admin Ponto

Hoje `Ponto.tsx` calcula `pularIntervalo` apenas a partir de `ponto_configuracoes.carga_diaria_min`. Vamos substituir por consulta a `ponto_horarios_professor` para o dia da semana atual do `targetId`.

Mudanças em `src/pages/Ponto.tsx`:
- Nova query `ponto-horario-dia` buscando o registro ativo de hoje (`dia_semana`, `ativo = true`).
- Calcular `cargaPrevistaMin` = (fim − início) e `intervaloPrevisto` = `intervalo_min`.
- `pularIntervalo` = `cargaPrevistaMin <= 240` **ou** `intervaloPrevisto === 0`. Fallback: `ponto_configuracoes` quando não houver horário cadastrado.
- Mostrar a **janela esperada** do dia ("Jornada prevista: 06:00 – 12:00, sem intervalo") no `StatusJornadaCard` via prop opcional `previsto`.
- Quando não houver jornada prevista, exibir aviso "Sem jornada prevista para hoje" (não bloqueia registro).

---

## 2) Novo módulo "Relatório Ponto"

### Rota e navegação
- Página `src/pages/RelatorioPonto.tsx` em rota `/ponto/relatorio` (lazy em `App.tsx`).
- Item "Relatório Ponto" em `coordPontoItems` no `AppSidebar.tsx` (ícone `FileText`), visível só a coord/admin.

### Abas da página
Duas abas (`Tabs`):
- **Diário/Período** — visão batida-a-batida.
- **Mensal (histórico)** — consolidado por mês.

### Filtros (comuns)
- Período (date range) — default mês atual na aba Diário, mês atual na aba Mensal.
- Profissional (Select com lista de `user_roles` + `profiles`; opção "Todos").
- Status (todos / em aberto / encerrada / com pendência) — só na aba Diário.

### Aba Diário/Período
Tabela (uma linha por jornada):
| Data | Profissional | Entrada | Início interv. | Fim interv. | Saída | Trabalhado | Previsto | Diferença | Pendências | Ações |

- "Previsto" vem de `ponto_horarios_professor` para o `dia_semana`.
- "Pendências" = badge para saída ausente, intervalo incompleto quando obrigatório, etc.
- Linha expandível mostra os **eventos** (`ponto_eventos`): tipo, data_hora, latitude/longitude (link Google Maps), dispositivo, observação.
- Ações (coord/admin): **Ajustar** abre `AjustarJornadaDialog` (já existente) — usa `fn_ponto_ajustar_jornada` com motivo obrigatório, gravando em `ponto_ajustes_log`.

### Aba Mensal (histórico)
Tabela consolidada por profissional × mês:
| Mês | Profissional | Dias trabalhados | Total trabalhado | Total previsto | Saldo (extra/falta) | Pendências | Status fechamento | Ações |

- Dados vêm de `ponto_jornadas` agregados em SQL no client (somando `minutos_trabalhados`) e cruzados com `ponto_fechamentos_mensais` para o status (`aberto`/`aprovado`).
- "Total previsto" = soma de janelas previstas em `ponto_horarios_professor` para os dias do mês.
- Linha expandível abre o detalhamento diário do profissional naquele mês (mesma tabela da aba Diário, filtrada).
- Ações: link rápido para **Fechamento Ponto** (`/ponto/fechamento`) já existente; botão **Recalcular** chamando `fn_ponto_calcular_fechamento`.

### Exportação de relatório
Botão "Exportar" no header de cada aba com menu (CSV / XLSX):
- **CSV**: gerado em browser (string + `Blob` + `URL.createObjectURL`), nome `relatorio-ponto-{escopo}-{periodo}.csv`.
- **XLSX**: usar `xlsx` (SheetJS) — adicionar dependência `xlsx`. Workbook com:
  - Aba "Resumo" (filtros aplicados, período, geração).
  - Aba "Jornadas" (linhas da tabela diária com totais).
  - Aba "Eventos" (todos os eventos do período: data_hora, tipo, lat/lng, dispositivo, observação).
  - Aba "Mensal" quando export disparado pela aba Mensal.
- Helper `src/lib/relatorioPontoExport.ts` para montar dados e disparar o download.

### Permissões
- Página inteira: `is_coordinator_or_admin`. Caso contrário, card "Acesso restrito".

---

## Arquivos afetados

- `src/pages/Ponto.tsx` — usar `ponto_horarios_professor` do dia.
- `src/components/ponto/StatusJornadaCard.tsx` — exibir jornada prevista (opcional).
- `src/pages/RelatorioPonto.tsx` — novo (Tabs Diário + Mensal).
- `src/components/ponto/RelatorioPontoFiltros.tsx` — novo.
- `src/components/ponto/RelatorioPontoDiarioTable.tsx` — novo (tabela + expand de eventos + ajuste).
- `src/components/ponto/RelatorioPontoMensalTable.tsx` — novo (consolidado mensal + expand).
- `src/components/ponto/ExportarRelatorioMenu.tsx` — novo (DropdownMenu CSV/XLSX).
- `src/lib/relatorioPontoExport.ts` — novo (geração CSV + XLSX).
- `src/App.tsx` — registrar rota `/ponto/relatorio`.
- `src/components/AppSidebar.tsx` — novo item em `coordPontoItems`.
- `package.json` — adicionar dependência `xlsx`.

Sem migrações de banco — `fn_ponto_ajustar_jornada`, `fn_ponto_calcular_fechamento`, `ponto_ajustes_log`, `ponto_horarios_professor`, `ponto_eventos`, `ponto_fechamentos_mensais` já existem.
