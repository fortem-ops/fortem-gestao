# Previsibilidade: parcelas de cartão em até 12x como recebimento futuro

## O que foi confirmado
- A tela Previsibilidade só soma cobranças **Pendentes ou Atrasadas**.
- Depois da correção de hoje, as 12 parcelas do Matheus Rigoni ficaram **Pago**, por isso sumiram da previsão, mesmo que o dinheiro só caia mês a mês.

## Regra proposta
- **Cartão em até 12x (já cobrado do cliente):** cada parcela aparece como recebimento futuro, com o valor da parcela do contrato. Ela cai 30 dias depois da venda, a segunda em 60 dias, e assim por diante. Exemplo: venda em 5x = 5 recebimentos mensais. É descontada a taxa do cartão parcelado (2–6x ou 7–12x) cadastrada nas taxas da Rede.
- Essas parcelas aparecem com a marca **"Já cobrado"**, separadas das de recorrência, que continuam como **"A cobrar"**, porque ainda não foram transacionadas.
- Parcelas cuja data de recebimento já passou saem da previsão e entram como realizado.
- Recorrência, mensalidades com baixa manual, Pix e dinheiro à vista seguem como hoje.
- Não conta como atraso, porque o cliente já pagou.

## Detalhes técnicos
- Em `vw_recebiveis_previstos_mensalidades`, adicionar um ramo `UNION` com as cobranças `status='pago'`, `numero_ciclo<>999`, cujo contrato ou venda tem `modalidade_pagamento in ('cartao_parcelado','cartao_credito')`. A data prevista é `data_venda + n*30 dias`, onde n é a ordem da parcela. Considerar só datas maiores ou iguais a hoje. A taxa vem de `credito_2_6x` ou `credito_7_12x`, conforme o número de parcelas.
- Nova coluna `ja_cobrado boolean`. Ajustar `fn_previsibilidade_*` para incluir esse ramo nos totais e excluí-lo de "em atraso". Na lista de Recebíveis, mostrar o selo correspondente.
- Rollback com a definição atual das views e funções, em `scripts/previsibilidade-cartao-parcelado.rollback.sql`.
- Teste: uma venda 5x paga gera 5 recebíveis futuros com o valor da parcela; uma recorrência paga não gera nada.
- Não altera cobranças, vendas, flags nem os Planos 1 e 2.
