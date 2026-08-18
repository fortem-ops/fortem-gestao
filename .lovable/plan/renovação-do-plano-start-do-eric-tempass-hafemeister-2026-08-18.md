# Renovação do plano Start do Eric Tempass Hafemeister

## O que aconteceu

O plano Start (R$ 479, mensal, renovação automática) do Eric foi cadastrado em 10/06/2026 com início em 05/06/2026, mas gravado com **data de próxima renovação em 09/06/2027** — quase um ano à frente.

A rotina diária de renovação roda todo dia às 3h (e vem rodando com sucesso, inclusive hoje), mas ela só processa planos cuja próxima renovação já venceu. Como a data do Eric está em 2027, o plano nunca entrou na fila.

Resultado: a cobrança de junho foi paga normalmente, e as mensalidades de **05/07** e **05/08** nunca foram geradas. Ele é o único plano ativo do sistema com esse desvio.

## O que será feito

1. **Corrigir a data do plano**: próxima renovação passa de 09/06/2027 para o ciclo mensal correto a partir de 05/06/2026.
2. **Gerar as duas mensalidades em atraso**: julho (vencimento 05/07) e agosto (vencimento 05/08), R$ 479 cada, no cartão de crédito cadastrado como forma padrão, marcadas como pendentes — a geração cria plano/contrato/cobrança pelo fluxo normal de venda.
3. **Deixar o ciclo em dia**: após as duas gerações, a próxima renovação fica em 05/09/2026 e volta a ser processada automaticamente pela rotina diária.
4. **Evitar repetição**: ajustar a regra automática para que planos mensais com renovação automática não aceitem uma data de próxima renovação mais de ~1 mês adiante do início — se vier assim, ela é recalculada para o ciclo mensal correto.
5. **Visibilidade**: incluir no relatório de planos um aviso para planos com renovação automática cuja próxima renovação esteja distante demais do padrão do plano, para detectar o caso cedo.

## Detalhes técnicos

- Dados: `UPDATE planos SET proxima_renovacao` para `bdfb7a46-…` e execução controlada da renovação retroativa (a Edge Function `renovar-planos-mensais` tem trava de idempotência de 20h por aluno, então as duas competências serão geradas em dois passos ou via inserção direta de venda com `data_venda` de cada competência, `origem = 'renovacao_automatica'`, disparando `fn_processar_venda` para criar plano/contrato/cobrança).
- Contrato ativo atual (`f5be0fdf-…`, `data_renovacao 2026-07-05`) será sincronizado com o novo ciclo; o contrato cancelado de 25/07 fica como está.
- Trigger `fn_planos_autorenew_defaults`: hoje só preenche `proxima_renovacao` quando vem `NULL`. Passa a também recalcular via `fn_proxima_renovacao_from` quando o valor recebido ultrapassa o ciclo (`duracao_meses`) do plano.
- Front: aviso em `src/pages/relatorios/Planos.tsx` (badge/linha destacada), sem mudar cálculo de valores.
