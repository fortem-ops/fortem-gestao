# Corrigir de vez o erro ao reativar contrato

## Causa confirmada
O histórico só aceita a operação escrita em minúsculas ("update"). A correção anterior gravou "UPDATE" (maiúsculas), e o banco recusou de novo. Nada foi salvo: o contrato continua encerrado.

## Correção
1. Recriar a função de reativação gravando a operação como `update` (minúsculas). O resto continua igual: o registro da ação "reativação", o motivo, a data antiga e a nova.
2. Conferir no banco, sem reativar nada, que o valor gravado está na lista aceita.

Nenhuma cobrança, valor, flag ou parte dos Planos 1 e 2 muda.
