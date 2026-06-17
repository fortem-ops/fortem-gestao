## Mudanças

### 1. Card "Comissionamentos" clicável no Dashboard
Arquivo: `src/components/dashboard/StatsCards.tsx`

- Adicionar `onClick: () => navigate("/comissionamentos")` ao item "Comissionamentos" em `row3` (hoje é o único card sem `onClick`), para que ao clicar navegue para a aba Comissionamentos.

### 2. Data final de plano correta em "Alerta Administrativo"
Arquivo: `src/components/dashboard/AdminAlertsWidget.tsx`

Problema: o widget calcula o vencimento como `data_inicio + duracao_meses`, ignorando `planos.data_fim`. Quando o aluno teve licença (plano/médica) ou ajuste manual, o campo `data_fim` no perfil é a fonte correta — como no caso da Zilmara Bonai (perfil: 09/07/2026; dashboard: 02/06/2026, valor calculado sem licenças).

Correção:
- Incluir `data_fim` no `select` da tabela `planos`.
- Calcular `end` como `plano.data_fim ? new Date(plano.data_fim + "T00:00:00") : data_inicio + duracao_meses` — mesma regra já usada em `StudentProfile.tsx`, `StudentList.tsx` e `StudentSummary.tsx`.
- Manter o restante da lógica de agrupamento (mês anterior / atual / próximo) inalterado.

Nenhuma alteração de schema/RLS é necessária; `data_fim` já existe e já é lido por outras telas.
