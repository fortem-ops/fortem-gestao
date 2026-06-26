## Diagnóstico

O widget **Plano Contratado** (`src/components/student/StudentPlan.tsx`) lê os créditos de Avaliação Funcional / Nutrição / Reabilitação diretamente da coluna `planos.servicos` (array de strings no formato `"N Tipo de Serviço"`).

Na venda atual:
- `VendaDialog.venderPlano` insere a venda e cria créditos em `creditos_aluno` (tradicional) ou chama a RPC `fn_criar_contrato_recorrencia` (recorrência), que cria `contratos` + 12 cobranças + créditos.
- **Nenhum dos dois fluxos atualiza `planos.servicos`** — por isso a contagem do widget mostra `0/0` mesmo após a venda registrar corretamente os créditos em "Serviços e Créditos Contratados".

Confirmado no banco: o plano ativo do aluno tem `servicos: []`.

## Correção

1. **`src/components/student/venda/VendaDialog.tsx` — `venderPlano.mutationFn`**
   Após sucesso da venda (e da RPC quando recorrência), sincronizar o registro do `planos` do aluno:
   - Desativar planos anteriores ativos (`ativo=false`).
   - Fazer `insert` em `planos` com:
     - `tipo` = nome do plano (`planoSelecionado.nome`)
     - `valor` = `totaisPlano.subtotalPlano` (ou mensal × período conforme já usado)
     - `data_inicio`, `duracao_meses = periodo_meses`, `data_fim = data_inicio + periodo`
     - `forma_pagamento_padrao`, `parcelas_padrao`, `renovacao_automatica = tipoCobranca === "recorrencia"`
     - `servicos`: array montado a partir de `servicosInclusos` no formato esperado pelo widget:
       - `${avaliacao_funcional} Avaliação Funcional`
       - `${nutricao} Consultas Nutrição`
       - `${reabilitacao} Consultas Reabilitação`
       (omitindo entradas com `0`)
   - Aplicar também para vendas sem etapa de serviços (Start) → array vazio.

2. **`supabase/functions`/RPC `fn_criar_contrato_recorrencia`**
   Não duplicar a criação do plano. A função continua criando `contratos` + `cobrancas` + `creditos_aluno`; o `planos` passa a ser responsabilidade exclusiva do frontend logo após a chamada. (Se hoje a RPC mexer no `planos`, manter inalterado — apenas o frontend garante o `servicos` correto via `update` posterior.)

3. **Invalidação de cache**
   Já existe `invalidatePlanoCaches(qc, alunoId)` no `onSuccess`. Garantir que continue sendo chamado em ambos os caminhos (tradicional e após o `PagarCartaoDialog` confirmar a recorrência online).

4. **Validação**
   - Vender um plano Power com opção "2 Nutrição" → widget deve mostrar `0/1 usados` em Avaliação Funcional e `0/2 usados` em Consultas Nutrição.
   - Vender Max → `0/3`, `0/5`, `0/5`.
   - Vender Start → widget exibe créditos zerados (sem benefícios), sem erro.

Nenhuma mudança de schema é necessária — apenas população correta de `planos.servicos`.
