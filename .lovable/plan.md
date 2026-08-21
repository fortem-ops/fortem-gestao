# Baixa de conta deve marcar a venda como "Pago"

## O que está acontecendo

No caso do ENIO (cobrança de 09/08/2026 já com status **Pago**, recebida via "Cartão de crédito (online)"), a venda correspondente de 05/08 continua como **Pendente** no Histórico de Vendas.

Causa confirmada nos dados e no código:

- A cobrança 09/08 foi baixada manualmente (`meio_registro = manual_admin`).
- A rotina de baixa tenta propagar para a venda, mas o `UPDATE` na venda carrega o filtro "só quando a forma de pagamento estiver vazia ou 'pendente'". A venda de 05/08 já tinha forma `cartao_credito`, então **nada** foi atualizado — nem a forma, nem o status.
- Além disso, as vendas desse aluno têm o vínculo direto com a cobrança em branco (`vendas.cobranca_id` nulo), então a propagação depende do caminho alternativo por plano/contrato — que existe apenas na tela do aluno, e não nos outros dois pontos de baixa do sistema.

## O que será feito

1. Separar as duas atualizações na baixa:
   - **Status da venda → "Pago" sempre** (exceto se a venda estiver cancelada ou estornada), independentemente da forma já registrada.
   - **Forma da venda** continua sendo preenchida apenas quando está vazia ou "a definir", para não sobrescrever o que foi combinado na venda.
2. Aplicar essa mesma regra nos três pontos onde a baixa acontece hoje:
   - tela de Contrato/Financeiro do aluno (baixa individual);
   - registro de pagamento na timeline de cobranças;
   - baixa em lote de cobranças vencidas.
3. Nos dois últimos, incluir o mesmo caminho alternativo já usado na tela do aluno (localizar a venda pelo contrato/plano da cobrança quando o vínculo direto estiver em branco), para que a propagação funcione em qualquer origem.
4. Correção pontual dos dados: marcar como **Pago** a venda de 05/08/2026 do ENIO, cuja cobrança já consta paga. Também verificar e corrigir vendas na mesma situação (cobrança do contrato paga e venda ainda pendente), sem tocar em vendas canceladas/estornadas ou sem cobrança quitada.

## Detalhes técnicos

- Arquivos: `src/pages/alunos/ContratoFinanceiro.tsx` (`handleBaixa`), `src/hooks/useContratos.ts` (`useRegistrarPagamento`, `useDarBaixaLote`).
- Trocar o update único com `.or('forma_pagamento.is.null,forma_pagamento.eq.pendente')` por:
  - update de status: filtro por venda alvo + `.not('status_pagamento','in','(cancelado,estornado)')`;
  - update de forma: mesmo alvo + o filtro `.or(...)` atual.
- Resolução do alvo: primeiro `cobranca_id = <id>`; se retornar 0 linhas, buscar `contrato_id` da cobrança → `plano_id` do contrato → vendas do aluno com aquele `plano_id`.
- Invalidations de cache já existentes permanecem (`vendas-aluno`, `cobrancas-*`, `inadimplencias*`).
- O data fix será feito com a ferramenta de dados (UPDATE em `vendas`), sem mudança de schema.
