# Por que a folha de set/2026 da Thaís não foi lançada

## O que aconteceu
No lote de hoje (18:56), 7 salários de set/2026 foram lançados. O da Thaís foi pulado com a mensagem "Já lançado para set/2026".

Ela não tinha sido lançada. A trava contra duplicidade confundiu com a **previsão** de salário dela: são despesas recorrentes pendentes "Salário Thaís dos Santos", uma por mês, de 05/10/2026 a 2028, criadas em 01/10. A previsão de 05/10/2026 tem o mesmo fornecedor, a mesma categoria e a mesma data, e a descrição também começa com "Salário". Por isso a trava achou que já existia um lançamento.

Os outros funcionários não têm previsões assim, então passaram.

## Correção proposta
1. **A trava passa a olhar só os salários lançados de verdade:** despesas pagas, ou com o mês entre parênteses (ex.: "(set/2026)"). A previsão pendente deixa de bloquear.
2. **A previsão do mês é aproveitada:** se existir um salário pendente do mesmo funcionário, da mesma categoria e da mesma data, o Lançar Folha **atualiza esse registro** em vez de criar outro. Ele ganha a descrição com o mês, valor, valor pago líquido, status pago, data de pagamento, PIX, conta e o detalhamento na observação. Assim não ficam duas despesas de salário no mesmo mês, a previsão some e o pago entra no lugar dela.
3. Vale para o lançamento individual e para o modo em lote, que usam a mesma função.
4. Depois disso, é só você relançar a folha de set/2026 da Thaís pela tela. Os outros 7 não são tocados, porque a trava continua reconhecendo os lançamentos deles.

As comissões e o DSR pendentes da Thaís continuam como estão, sem mudança no comportamento atual.

## Detalhes técnicos
- `LancarFolhaDialog.tsx` → `lancar()`: a busca de duplicidade ganha o filtro `status = 'pago'` ou `descricao ilike '%(mmm/yyyy)%'`.
- Busca separada de previsão: `status='pendente'`, mesmo `fornecedor_id`/`categoria_id`/`data_competencia` e `descricao ilike 'Salário%'`. Se encontrar, faz `update` por id com o mesmo payload do insert (exceto `created_by`). Se não encontrar, faz `insert` como hoje.
- Sem mudança de banco e sem alterar nenhum lançamento existente.
