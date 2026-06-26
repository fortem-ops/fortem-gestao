## Problema observado (Marilza Vallejo · Start+ 1x/sem)

Foram criados **2 contratos** para a mesma venda:

| Contrato | valor_cobrado | parcelas | vigência | cobranças |
|---|---|---|---|---|
| A (trigger automático) | R$ 3.588,00 (total anual) | 1 | mensal | 1 |
| B (RPC fn_criar_contrato_recorrencia) | R$ 299,00 (mensal) | 12 | **mensal** (errado) | 12 |

Causas:

1. **Duplicação** — Ao salvar a venda, o trigger `trg_vendas_processar` cria o registro em `planos`, o que dispara `trg_auto_criar_contrato_ciclo` e gera o contrato A. Em seguida o frontend chama `fn_criar_contrato_recorrencia`, que cria o contrato B. As duas vias coexistem sem se conhecerem.
2. **Vigência sempre "mensal"** — Tanto `fn_criar_contrato_recorrencia` quanto `fn_auto_criar_contrato_ciclo` gravam `vigencia_tipo='mensal'` fixo, independente de o plano ser anual (Start+, Power, Pro, Max — `periodo_meses=12` no catálogo).

## Correções

### 1. `fn_criar_contrato_recorrencia` (única fonte de verdade para vendas via UI)

- Derivar `vigencia_tipo` do catálogo: `'anual'` quando `planos_catalogo.periodo_meses = 12`, senão `'mensal'`.
- Ajustar `data_fim` para `data_inicio + periodo_meses` (hoje está fixo em +12 meses; correto para anuais, mas precisa respeitar mensais quando reutilizado).
- Manter geração de 12 cobranças mensais para planos anuais em recorrência (já está correto).

### 2. `fn_auto_criar_contrato_ciclo` (trigger em `planos`)

Evitar duplicação. Estratégia: o trigger só deve atuar em renovações automáticas mensais (job `renovar-planos-mensais` e backfill), **nunca** durante a inserção de uma venda nova.

- Adicionar guarda: pular quando já existir um registro em `vendas` com `plano_id = NEW.id` OU criado na mesma transação para o mesmo `aluno_id` com `tipo='plano'` nos últimos segundos.
- Também aplicar a mesma lógica de `vigencia_tipo` baseada no `periodo_meses` do plano correspondente no catálogo (lookup por `lower(tipo)` + `frequencia`/`valor`).

### 3. Limpeza dos dados da Marilza

- Remover o contrato A duplicado (R$ 3.588, 1 cobrança) e sua cobrança/ciclo associados, mantendo o contrato B (12x R$ 299).
- Atualizar o contrato B para `vigencia_tipo='anual'`.

### 4. Backfill de vigência

Atualizar `contratos.vigencia_tipo` para `'anual'` em todos os contratos cujo `plano_tipo` esteja em (`start_plus`, `power`, `pro`, `max`) — esses sempre são planos de 12 meses no negócio atual.

## Validação

- Repetir venda Start+ 1x/sem para um aluno teste → resultado esperado: **1 único contrato**, badge **"Anual"**, **12 cobranças mensais** de R$ 299.
- Renovação automática mensal de Start (mensal) continua criando 1 contrato por ciclo via trigger.

## Arquivos / objetos alterados

- Migração SQL: `fn_criar_contrato_recorrencia`, `fn_auto_criar_contrato_ciclo`, UPDATE de backfill em `contratos`, DELETE do contrato duplicado da Marilza.
- Nenhuma alteração de frontend necessária (o badge "Anual" já é renderizado em `ContratoFinanceiro.tsx` quando `vigencia_tipo='anual'`).
