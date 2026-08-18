# Corrigir "Valor total do contrato" e "Valor mensal"

## Problema

No contrato anual do João Vicente (Start+), o cabeçalho mostra:

- Valor total do contrato: R$ 399,00
- Valor mensal: R$ 33,25

O correto é total R$ 4.788,00 e mensal R$ 399,00. Hoje a tela assume que o campo de valor do contrato guarda sempre o valor TOTAL e divide pelo número de parcelas. Nos planos anuais Start+, Power, Pro e Max esse campo guarda a MENSALIDADE, então a conta sai invertida.

Verificado no banco: esse contrato tem valor 399, 12 parcelas e 12 cobranças de R$ 399 (soma 4.788). Porém existem contratos antigos em que o mesmo campo realmente guarda o total (ex.: máquina de crédito parcelada), então não dá para simplesmente multiplicar sempre.

## Solução

Somente exibição (nenhuma alteração de dados ou de cobranças):

1. Quando o contrato tem cobranças geradas, usar elas como fonte de verdade:
   - Valor total do contrato = soma das cobranças do contrato
   - Valor mensal = valor de uma parcela (total dividido pela quantidade de cobranças)
2. Quando não há cobranças geradas, usar a regra por plano: para contratos anuais de Start+, Power, Pro e Max o valor guardado é a mensalidade, logo total = valor x meses de vigência e mensal = valor.
3. Demais casos (planos avulsos/legados sem cobranças) mantêm o comportamento atual: total = valor guardado, mensal = valor / parcelas.
4. Contratos mensais continuam mostrando apenas "Valor mensal".

## Detalhes técnicos

- Arquivo: `src/pages/alunos/ContratoFinanceiro.tsx`, bloco de `Info` de valores (linhas ~563-578).
- A consulta de cobranças do contrato já existe no componente; basta agregar `valor` e a contagem em um `useMemo` e usar como base do cálculo, com fallback para a regra por `plano_tipo` / `vigencia_tipo` / `parcelas`.
