# Estornos/créditos na fatura ao associar várias despesas

## O que muda para você

- Na aba "Várias despesas (soma)" aparece a seção **"Créditos da fatura (estornos/devoluções)"**.
- Você adiciona uma ou mais linhas com descrição e valor (ex.: "Devolução compra X — R$ 154,44"). O valor é **subtraído** da soma.
- O rodapé passa a mostrar: compras selecionadas − créditos = total, comparado com a saída do banco. O botão só libera quando o total bate (R$ 0,01 de tolerância).
- Nenhuma despesa é criada nem alterada pelo crédito; ele fica registrado junto da conciliação e aparece em Conciliação Bancária ("Soma de N despesas − R$ 154,44 em créditos").
- Desfazer remove a conciliação inteira, incluindo os créditos.

## Detalhes técnicos

- Migração aditiva em `conciliacao_saida_itens`: `despesa_id` passa a aceitar nulo (só para créditos), novas colunas `tipo text default 'despesa'` (`despesa` | `credito`) e `descricao text`; CHECK: `despesa` exige `despesa_id`, `credito` exige `despesa_id` nulo, descrição e valor > 0.
- Nova versão de `fn_conciliar_saida_multiplas(p_movimento_id, p_despesa_ids uuid[], p_creditos jsonb default '[]')`: valida créditos (descrição, valor > 0, máx. 20), confere no servidor soma(despesas) − soma(créditos) = valor da saída, grava os itens de crédito. Mínimo passa a ser 1 despesa quando houver crédito (2 sem crédito). Assinatura antiga removida e substituída (mesmas permissões).
- `fn_desfazer_conciliacao_saida` já desativa todos os itens pelo `conciliacao_id`; créditos seguem junto.
- Front: `ConciliarSaidaSoma.tsx` (linhas de crédito + total) e resumo em `ConciliacaoBancaria.tsx`. Teste unitário do total líquido em centavos.
