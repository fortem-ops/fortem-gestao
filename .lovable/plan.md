## Problema

Em `StudentPlan.tsx` a query carrega o plano com `eq("ativo", true)` e exibe o badge "Ativo" sem checar se o `data_fim` já passou. Quando um contrato expira (ex.: ELIEZER BERNART), o plano permanece marcado como `ativo=true` no banco, então a aba "Plano Contratado" continua mostrando-o como Ativo, mesmo o perfil do aluno já estando Inativo (que usa lógica de `studentStatus` baseada em datas).

A "Histórico de Vendas" abaixo já lê da tabela `vendas` independentemente, então o registro da venda continua aparecendo lá — o ajuste é apenas tirar o plano expirado do bloco "Plano Contratado".

## Solução

### 1. Tratar plano expirado como inativo na UI (frontend)
Em `src/components/student/StudentPlan.tsx`, na query `["plano_ativo", student.id]`:
- Após carregar o plano com `ativo=true`, verificar se `data_fim < hoje` E `renovacao_automatica = false` (ou tipo não auto-renovável via `isAutoRenewPlan`).
- Se expirado, retornar `null` para que o componente renderize o estado "Nenhum plano ativo encontrado" — e o `HistoricoVendas` abaixo continua mostrando a venda como registro histórico.

Cancelamentos agendados futuros (`data_fim > hoje`) continuam exibidos normalmente, mantendo o comportamento atual do badge "Cancelamento agendado".

### 2. Normalizar dados existentes (banco)
Rodar um UPDATE pontual para marcar como inativos os planos já vencidos e sem renovação automática:

```sql
UPDATE public.planos
SET ativo = false
WHERE ativo = true
  AND data_fim IS NOT NULL
  AND data_fim < current_date
  AND renovacao_automatica = false
  AND tipo NOT ILIKE '%mensal recorrente%'; -- preservar planos auto-renováveis
```

Isso alinha o estado do banco com a UI e garante que outras telas que filtram por `ativo=true` (Dashboard, comissionamento, etc.) também passem a tratar corretamente.

### 3. Manter consistência futura
A renovação mensal já é tratada por `renovar-planos-mensais`. Para evitar regressão, a checagem de expiração no frontend (item 1) age como fallback caso algum plano não-recorrente vença antes de qualquer rotina o limpar.

## Fora do escopo
- Não alterar o cálculo de `getDisplayStatus` do aluno (já correto).
- Não alterar `HistoricoVendas` — venda permanece como registro histórico automaticamente.
- Não criar cron job novo (o UPDATE pontual + checagem de leitura já resolvem; podemos adicionar depois se necessário).