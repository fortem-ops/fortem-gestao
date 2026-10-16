# Previsibilidade: "Próximos 30/60/90 dias" pela data de cobrança

## O que muda
- Os cartões **Próximos 30, 60 e 90 dias** passam a somar pela **data de vencimento**, ou seja, pela data em que cada valor é cobrado do cliente, e não mais pelo dia em que o dinheiro cai na conta.
- Hoje, os próximos 30 dias passariam de R$ 2.239,40 para cerca de R$ 36 mil. As recorrências que vencem até 15/11 entram nesse total.
- As parcelas de cartão marcadas como "Já cobrado" continuam entrando pela data de cada parcela, porque o cliente já pagou e não há uma nova cobrança.
- O texto embaixo de cada cartão explica a regra: "Valores a cobrar, já sem a taxa".
- "A receber este mês", o gráfico, o Calendário e os Dias úteis continuam pela data em que o dinheiro cai na conta.

## Detalhes técnicos
- Recriar `fn_previsibilidade_kpis` trocando o filtro dos campos `proximos_30/60/90_liquido` de `data_recebimento_prevista` para `data_vencimento`. No ramo de cartão, `data_vencimento` já é igual a `data_recebimento_prevista`.
- Adicionar `hint` aos três `KpiCard` em `src/pages/financeiro/Previsibilidade.tsx`.
- Guardar o rollback com a definição atual da função.
