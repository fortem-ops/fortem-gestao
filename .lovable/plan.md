## Alterações em `src/pages/Prospects.tsx`

### 1. KPI: substituir "Conversão Lead → Prospect" por "Conversão Prospect → Aluno (mês)" com percentual

- O card atual (linha 292) que mostra `conversionRate%` (Lead→Prospect, 30d) será trocado por **"Conversão Prospect → Aluno (mês)"** mostrando um **percentual**.
- Cálculo: `(prospects convertidos em aluno no mês atual) / (prospects ativos no início do mês + novos prospects do mês) × 100`. Fonte: `pipeline_movements` filtrando `to_stage_id = "Aluno ativo"` e `from_stage_id ∈ funil prospects` no mês corrente.
- O card existente "Conversão Prospect → Aluno (mês)" (linha 296, que mostra a contagem absoluta) é mantido como está — sem duplicação, pois um vira % e o outro continua contagem absoluta.

### 2. Histórico da origem de **conversão** dos prospects (6m)

- O gráfico atual "Histórico da origem dos prospects (6m)" (linha 331) considera origem de **todos os prospects criados**. Será **substituído** por gráfico que considera apenas prospects que **converteram em Aluno ativo** nos últimos 6 meses, agrupado por mês de conversão e empilhado por origem (`pipeline_metadata.origem_lead`).
- Mesmo formato visual (BarChart vertical empilhado).

### 3. Botão "Não conversão" com motivos configuráveis

- Novo botão de ação na linha de cada prospect (ícone `UserX`), ao lado do botão "Converter em aluno".
- Abre dialog com seleção de motivo: **Financeiro**, **Localização**, **Outros**, e opção **+ adicionar** (input livre para novo motivo).
- Os motivos personalizados ficam salvos em nova tabela `prospect_nao_conversao_motivos` (campos: `nome`, `ordem`, `ativo`, `created_by`). Os 3 motivos padrão são pré-cadastrados via seed na migration.
- Ao confirmar: grava `motivo_perda` em `alunos`, registra novo motivo (se foi "+adicionar"), e move o prospect para a stage **"Aluno perdido"** via `fn_move_pipeline` (reaproveita lógica do `MarkLostDialog`).

### Detalhes técnicos

- **Migração**: criar tabela `prospect_nao_conversao_motivos` com RLS (SELECT autenticados; INSERT/UPDATE/DELETE coord/admin) e seed dos 3 motivos padrão (`Financeiro`, `Localização`, `Outros`).
- **Novo componente**: `src/components/prospects/NaoConversaoDialog.tsx` (RadioGroup com motivos + botão "+ adicionar" que revela Input + Salvar).
- **Hook**: `src/hooks/useProspectMotivos.ts` para listar/criar motivos (similar a `useLeadOrigens`).
- **Prospects.tsx**: novas queries para conversões mensais por origem (6m) e taxa percentual do mês; novo estado `naoConvTarget`; novo `<Button>` na coluna de ações.

Nenhuma outra página é afetada.
