# Exportação de Encomendas fiel à tela

## Problema
O Excel exportado inclui a coluna "Resumo do pedido", que lista **todos** os itens do pedido — inclusive os que foram filtrados fora da tela. Na tela, esse resumo não é uma coluna visível: ele só aparece dentro da janela de "Dar baixa". Ou seja, o exportado mostra informação que a tela não mostra.

## Correção
Em `src/lib/encomendasExport.ts`:

1. **Remover a coluna "Resumo do pedido"** da aba "Encomendas" do Excel. O arquivo passa a ter exatamente as colunas que a tela mostra: Data, Cliente, Modelo, Cor, Tamanho, Qtd., Valor dos itens, Valor recebido, Cupom, Brinde e Status.
2. **Manter o campo `resumoPedido` no tipo `EncomendaExport`** e na montagem das linhas em `EncomendasTab.tsx` — ele continua necessário para a janela de "Dar baixa (pagamento presencial)". Só sai do Excel.

Nada muda na aba "Resumo" (totais já respeitam os filtros), no nome do arquivo, nem em nenhuma outra tela.

## Validação
- Exportar sem filtro e com filtros (período, modelo, cor) e conferir que o Excel traz só o que está na tela, sem a coluna de resumo.
- Conferir que a janela "Dar baixa" continua mostrando o resumo do pedido.
- Build sem erros.
