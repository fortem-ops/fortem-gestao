# Fase 3 — Relatório pré-implementação (schema)

## 1. Status de cobranca: é CHECK em TEXT, não enum

`cobrancas.status` é `text NOT NULL DEFAULT 'pendente'`, restrito por:

```sql
cobrancas_status_check CHECK (status IN ('pendente','pago','atrasado','cancelado','isento'))
```

Não existe tipo enum `cobranca_status` — o `CobrancaStatus` de `src/types/financeiro.ts` é só o espelho TS desse CHECK.

Distribuição atual: pago 786, pendente 486, atrasado 150, cancelado 113, isento 0.

Sobre "falha definitiva após 3 tentativas": **não há status adequado hoje.**
- `cancelado` já é usado semanticamente para cobranças anuladas administrativamente (113 registros, incluindo as limpezas de contratos renovados) — reaproveitar polui o histórico financeiro e o relatório de inadimplência.
- `atrasado` é o estado natural de quem venceu e não pagou, e deve continuar sendo o estado de quem falhou (a dívida continua existindo).

Recomendação: **não criar um novo status**. Cobrança que esgota as tentativas permanece `atrasado` (a dívida é real) e o "desistiu de tentar" vira um campo de controle (`proxima_tentativa_em = NULL` + `tentativas >= limite`), não um status financeiro. Se ainda assim quiser um estado visível, o caminho é `ALTER ... DROP CONSTRAINT / ADD CONSTRAINT` com `'falha_cobranca'` incluído — barato, mas exige atualizar `CobrancaStatus` e todos os filtros de UI que hoje assumem 4 valores.

## 2. Controle de tentativa em cobrancas: NÃO existe

Colunas de `cobrancas`: `id, contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, data_pagamento, status, forma_pagamento, meio_registro, gateway, tid, comprovante_url, registrado_por, created_at`.

Nenhum `tentativas`, `ultima_tentativa_em` ou `proxima_tentativa_em`. Precisa criar.

Existe a tabela `cobranca_tentativas`, mas **ela não serve**: aponta para `parcela_id` (não `cobranca_id`), é orientada a cobrança de régua/contato (`canal`, `resultado`, `observacao`) e está **vazia (0 registros)**. Não reaproveitar — é outro domínio.

Detalhes úteis para a migration futura:
- Já existe `UNIQUE (contrato_id, numero_ciclo)` — ou seja, a cobrança já é a chave natural do ciclo mensal, o que reforça a arquitetura orientada a cobrança.
- Índice existente `cobrancas_vencimento_idx ON (data_vencimento) WHERE status = 'pendente'` — **não cobre `atrasado`**, que é onde a maioria dos alvos do cron vai estar. O cron vai querer um índice parcial novo cobrindo `status IN ('pendente','atrasado')` mais `proxima_tentativa_em`.

## 3. pagamentos_rede.venda_id

```
venda_id  uuid  NOT NULL
pagamentos_rede_venda_id_fkey  FOREIGN KEY (venda_id) REFERENCES vendas(id)
pagamentos_rede_venda_idx  btree (venda_id)
```

Sem `ON DELETE`, sem unique. Não há nenhum outro CHECK na tabela.

Tornar nullable é seguro do lado do banco (`DROP NOT NULL` não invalida as linhas existentes, e a FK continua valendo para valores não nulos). Os pontos de atenção são de código, não de schema:
- `rede-cobrar-token` e `rede-cobrar-cartao` fazem `select ... eq("venda_id", venda_id)` para idempotência — continuam funcionando, mas passam a poder cruzar linhas de cobrança se o filtro não for explícito.
- O CHECK proposto `(venda_id IS NOT NULL OR cobranca_id IS NOT NULL)` é válido e passa imediatamente, já que todas as linhas atuais têm `venda_id`.
- Vale acrescentar índice em `cobranca_id` e o índice único parcial de idempotência por cobrança (`WHERE status IN ('approved','pending')`).

## 4. Query do tokenization_id ativo (idêntica à de rede-cobrar-token)

```ts
const { data: tokenizacao } = await supabase
  .from("rede_tokenizacoes")
  .select("tokenization_id")
  .eq("cartao_salvo_id", cartao_id)
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!tokenizacao?.tokenization_id) { /* cartão precisa ser recadastrado */ }
```

Confirmações no schema/dados:
- `rede_tokenizacoes.cartao_salvo_id` é `uuid NULL`, FK para `cartoes_salvos(id) ON DELETE SET NULL`.
- `status` é text livre (sem CHECK); valores reais hoje: `active` (6, todos com `cartao_salvo_id`) e `failed` (4, todos sem `cartao_salvo_id`).
- Índices: `idx_rede_tokenizacoes_status` e `idx_rede_tokenizacoes_aluno`. **Não há índice em `cartao_salvo_id`** — irrelevante com 10 linhas, mas vale criar quando a base crescer.
- Só 6 cartões tokenizados hoje, ou seja o universo inicial de contratos cobráveis automaticamente é pequeno — bom para um rollout controlado.

## O que NÃO foi alterado

Nenhum arquivo de código e nenhuma migration foram executados nesta investigação.
