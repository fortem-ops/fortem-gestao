## Objetivo

Transformar a correção feita para a Marilza em **regra permanente do sistema**, garantindo que:
1. Nenhum aluno tenha créditos de serviço duplicados/órfãos.
2. Toda nova venda crie créditos vinculados corretamente (`origem_id = venda.id`).
3. Toda exclusão de venda limpe contratos, ciclos, cobranças e créditos em cascata.
4. O banco mantenha integridade automaticamente, sem depender só do frontend.

---

## 1. Data-fix global (limpeza retroativa)

Migração única que varre **todos os alunos** e:

- Remove `creditos_aluno` onde `origem_tipo='plano'` e `origem_id` aponta para:
  - contrato com `status='cancelado'`, **ou**
  - venda inexistente (registro órfão).
- Remove `cobrancas` → `ciclos_credito` → `contratos` com `status='cancelado'` (na ordem correta de FK).
- Desativa (`ativo=false`) planos sem venda associada nem contrato ativo.
- Dedup de créditos ativos por `(aluno_id, atividade, origem_tipo, origem_id)` mantendo o mais recente — apaga sobras antigas de antes do fix.

Saída: relatório (`RAISE NOTICE`) com totais removidos por categoria.

---

## 2. Regras no banco (garantia estrutural)

### 2a. Trigger de cascata em `vendas`

`trg_cleanup_on_venda_delete` (BEFORE DELETE em `public.vendas`):
- Apaga `creditos_aluno` com `origem_id = OLD.id` (qualquer `origem_tipo`).
- Para cada `contrato` com `plano_id = OLD.plano_id`: apaga `cobrancas`, `ciclos_credito`, `inadimplencias`, depois o contrato.
- Apaga `pagamentos_rede` e `comissionamentos` ligados à venda.
- Se o `plano` ficar sem outras vendas/contratos ativos → `ativo=false`.

Resultado: a UI pode simplesmente fazer `DELETE FROM vendas` que o resto cai junto. O HistoricoVendas vira mais simples e qualquer outra origem de exclusão (SQL manual, RPC futura) fica segura.

### 2b. Índice único parcial em `creditos_aluno`

```
CREATE UNIQUE INDEX idx_creditos_unicos_por_venda
ON creditos_aluno (aluno_id, atividade, origem_tipo, origem_id)
WHERE ativo = true AND origem_id IS NOT NULL;
```

Impede que qualquer caminho (trigger + frontend, ou duas chamadas) crie dois créditos da mesma atividade para a mesma venda. Tentativas duplicadas falham na hora.

### 2c. Hardening do trigger `fn_processar_venda`

- Garantir que insere o crédito de Treino com `ON CONFLICT DO NOTHING` (usando o índice acima), para tolerar reexecução.
- Não tocar mais em planos antigos (já está assim, manter).

---

## 3. Regras no frontend (consistência)

### 3a. `VendaDialog.tsx` — `criarCreditosServicos`

- Já passa `origem_id = vendaId` (Marilza-fix). **Manter como contrato fixo**: a função nunca insere crédito sem `origem_id`. Adicionar guard que lança erro se `vendaId` vier vazio.
- Usar `upsert` com `onConflict: 'aluno_id,atividade,origem_tipo,origem_id'` para ficar idempotente com o índice do 2b.

### 3b. `HistoricoVendas.tsx` — `confirmarExclusao`

- Simplificar: chamar apenas `delete from vendas where id=...`. A cascata do trigger 2a cuida do resto.
- Manter `invalidateQueries` em planos, créditos, contratos e cobranças.

### 3c. Tipos / helpers

- Em `src/lib/vendas-servicos.ts`, documentar que `montarServicosInclusos` é a **única fonte** de quantidades de serviço por plano. Nada de hard-code em outro lugar.

---

## 4. Verificação

- Query: alunos com mais de 1 crédito ativo de "Avaliação Funcional" da mesma origem → deve retornar 0.
- Query: créditos `origem_tipo='plano'` com `origem_id` apontando para venda inexistente → 0.
- Query: contratos `cancelado` com cobranças/ciclos pendentes → 0.
- Teste manual: criar venda Start+ para qualquer aluno → 1 AF + 1 Treino. Excluir a venda → ambos somem, plano desativa se único.

---

## Detalhes técnicos

- O índice único exige que a limpeza (passo 1) rode **antes** de criá-lo, senão falha.
- O trigger de cascata é `BEFORE DELETE` para evitar violar FK de `cobrancas → contratos`.
- Nenhuma alteração em RLS ou grants — apenas DDL de triggers/índices e DML de limpeza.
- `fn_processar_venda` continua sendo o criador do crédito de Treino; o frontend só cuida dos serviços (AF/Nutri/Reab).
