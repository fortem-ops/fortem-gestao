## Diagnóstico

A aluna CAMILA CANALI SCHMITZ tem o plano Start renovado automaticamente em 25/06/2026 no fluxo **antigo**:

- `planos`: novo registro ativo (25/06 → 25/07) ✔
- `vendas`: nova venda `origem='renovacao_automatica'`, `status_pagamento='pendente'` ✔
- `contratos` / `cobrancas` / `inadimplencias`: **nada**

A aba **Pagamentos** lê apenas `contratos`/`cobrancas` (novo módulo financeiro), e a aluna nunca teve contrato criado — existem **68 alunos com plano recorrente ativo sem `contrato` correspondente**. Por isso a aba aparece vazia e dá a impressão de "plano pago".

Além disso, o job diário `renovar-planos-mensais` só gera `vendas` legadas — não cria `cobrancas` nem alimenta o ciclo do novo módulo. O job `processar-cobrancas-diario` (que vira `cobrança → atrasada → inadimplência`) só funciona se a cobrança existir.

## Objetivo

Toda renovação mensal deve gerar automaticamente uma **cobrança pendente** vinculada a um **contrato** do aluno, para que:
1. A aba **Pagamentos** mostre a mensalidade do ciclo corrente como pendente.
2. Se vencer sem pagamento, vire **inadimplência** automaticamente (job já existente alimenta o widget de Resumo).
3. Baixa manual ou pagamento via Rede atualize tanto `vendas` quanto `cobrancas`.

## Decisões confirmadas
- Forma de pagamento padrão no backfill e em novas renovações: **`cartao_recorrencia`** (Rede Online).
- Backfill cobre **somente o ciclo corrente** (sem histórico retroativo de cobranças passadas).

## Plano

### 1. Backfill (migração de dados)
Para cada `planos` ativo, com `renovacao_automatica=true`, sem `contratos`:
- Criar `contratos` (status `ativo`, mapeando `tipo→plano_tipo`, `valor→valor_cobrado/valor_base`, `data_inicio = planos.data_inicio`, `data_fim = proxima_renovacao`, `forma_pagamento = 'cartao_recorrencia'`, `parcelas = 1`).
- Criar `ciclos_credito` apenas do ciclo corrente.
- Criar `cobrancas` apenas do ciclo corrente (`numero_ciclo=1`, `data_vencimento = proxima_renovacao`):
  - Se já existe `vendas` paga do ciclo corrente → `pago` com `data_pagamento`.
  - Caso contrário → `pendente`.

### 2. Renovação automática integrada
Atualizar `supabase/functions/renovar-planos-mensais/index.ts` para, **além** de criar a `vendas` legada:
- Localizar (ou criar via mesmos defaults do backfill) o `contrato` ativo do aluno.
- Inserir `cobranca` `pendente` com `data_vencimento = proxima_renovacao` e `numero_ciclo` incrementado a partir do último ciclo do contrato.
- Inserir `ciclos_credito` do novo período.
- Gravar `vendas.cobranca_id` apontando para a cobrança recém-criada (nova coluna FK opcional).

### 3. Sincronização venda ↔ cobrança
Triggers `SECURITY DEFINER` (`search_path=public`):
- `vendas`: ao mudar `status_pagamento` para `pago` e houver `cobranca_id`, marca a `cobranca` como `pago` com a `data_venda` (ou hoje).
- `cobrancas`: ao mudar para `pago`, marca a `vendas` ligada como `pago` (idempotente, sem loop via `pg_trigger_depth`).

### 4. Validação
- Rodar o backfill e conferir que Camila passa a ter contrato + cobrança pendente 25/07/2026 visível na aba Pagamentos.
- Antecipar `data_vencimento` para uma data passada em ambiente de teste e rodar `processar-cobrancas-diario` para confirmar geração de `inadimplencias` e exibição no widget de Resumo.
- Conferir que dar baixa manual em uma cobrança marca a `vendas` correspondente como paga.

## Detalhes técnicos
- Backfill via `supabase--migration` (DML em transação) — joins `planos ⨝ alunos ⨝ vendas` para datas/valor.
- Nova coluna: `vendas.cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL`.
- Triggers seguem o padrão de hardening (`SECURITY DEFINER` + `SET search_path = public`).
- Sem alterações no front-end — a aba Pagamentos já consome `contratos`/`cobrancas`.
