# Receitas: mensalidades automáticas + conciliação com o extrato

## O que acontece hoje
- A tela Receitas não recebe nada sozinha. Tudo o que aparece até setembro veio de uma importação única do extrato, feita em 30/09.
- Em outubro só existe o Repasse Agregador que você lançou. As mensalidades pagas em Cobranças e as parcelas futuras do cartão não chegam até Receitas.

## O que vai mudar
1. **Cobrança paga vira receita na hora.** A receita leva o aluno, o plano, a forma de pagamento e a data, com status "Recebido". Se a baixa for desfeita, a receita sai junto.
2. **Parcelas futuras do cartão aparecem como "Previsto".** Seguem a mesma regra da Previsibilidade: mesmo dia do mês + 1 dia, passando para o próximo dia útil. Quando a data chega, passam a "Recebido".
3. **Outubro desde já.** As cobranças pagas a partir de 01/10 entram de uma vez, junto com as parcelas futuras. Setembro e os meses anteriores ficam como estão, para não duplicar o extrato já importado.
4. **O extrato só concilia.** Importações futuras do Inter marcam como "Conciliado" a receita que bate em valor e data, sem criar um segundo lançamento. Entradas sem par, como repasses e Gympass, continuam sendo lançadas.
5. **Lançamentos manuais**, como o seu Repasse Agregador, continuam como estão.

Ficam de fora: cobranças de R$ 0,00 (Gympass, Total Pass, outro), vendas de teste 2027 e multas de cancelamento. Planos 1 e 2, as flags e as cobranças não mudam.

## Detalhes técnicos
- Adicionar em `receitas` as colunas `origem_tabela`/`origem_id` (únicas juntas) e `previsto`.
- Gatilho AFTER UPDATE de status em `cobrancas`: ao virar pago, faz upsert da receita (status recebido, valor, data_pagamento, forma); ao sair de pago, apaga a receita de origem 'cobranca'.
- As parcelas futuras do cartão vêm de `vw_recebiveis_previstos_cartao_parcelado`. Uma função diária (ou view unida na consulta) faz upsert com origem 'cartao_parcela' e id determinístico.
- O backfill de outubro fica na migração. Um script de rollback apaga só as linhas com origem_tabela informada.
- Na importação do extrato, antes de inserir, procurar uma receita com o mesmo valor e data dentro de ±3 dias. Se encontrar, marcar como conciliado.
- Teste: uma cobrança paga gera 1 receita, e repetir não duplica.
