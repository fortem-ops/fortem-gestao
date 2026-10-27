# Valor certo na janela "Cobrar no cartão" do Histórico de Vendas

## Resposta
- Sim: o ícone de cartão no Histórico de Vendas usa o mesmo caminho seguro do botão "Cobrar". Para esta venda, o servidor cobra só a 1ª mensalidade (R$ 453,90), não o total.
- O botão "Cobrar" na tabela do contrato não apareceu porque a tela ainda tinha os dados carregados antes da mudança. Recarregar a página (F5) faz ele aparecer.

## Problema encontrado
- A janela aberta pelo Histórico de Vendas mostra o total da venda (R$ 5.446,80) e oferece parcelamento, mas o servidor cobra R$ 453,90 à vista. O valor da tela não bate com o valor cobrado.

## O que muda
- Em vendas manuais recorrentes, a janela aberta pelo Histórico de Vendas passa a mostrar o valor da 1ª mensalidade como cobrança recorrente, igual ao botão "Cobrar" do contrato.
- Nada muda no servidor, no valor cobrado nem nas outras vendas.

## Detalhes técnicos
- `HistoricoVendas.tsx`: quando `origem === "manual"` e `tipo_cobranca === "recorrencia"`, passar `recorrencia` e `valor = valor_final / parcelas` (só para mostrar) ao `PagarCartaoDialog`.
