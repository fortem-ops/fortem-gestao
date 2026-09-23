# Corrigir valores exibidos nos contratos

## Implementação
- Centralizar o cálculo de total e parcela usando a modalidade real, sem listas de planos.
- No cartão financeiro, buscar a venda vinculada ao mesmo plano e priorizar `valor_final` e `parcelas`.
- Para recorrência mensal, calcular o total pela mensalidade e duração real entre início e fim.
- Para venda tradicional, tratar `valor_final` como total e dividir apenas pelas parcelas.
- Aplicar o mesmo cálculo aos resumos irmãos que hoje rotulam o valor bruto como mensal.

## Validação
- Cobrir recorrência, venda tradicional, fallback sem venda e duração real com testes.
- Conferir no banco os sete contratos identificados, sem alterar qualquer dado.
- Verificar na tela que Frederico exibe total de R$ 4.908,00.
