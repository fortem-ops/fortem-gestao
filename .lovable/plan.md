# Exportar relatório de Encomendas em Excel

## Objetivo
Na aba **Loja > Encomendas**, adicionar um botão "Exportar Excel" que gera um arquivo `.xlsx` com as encomendas **exatamente como estão filtradas na tela** (busca, período, modelo, cor, tamanho e valor recebido).

## Como vai funcionar
- Botão "Exportar Excel" (ícone de planilha) ao lado do contador de itens, na barra de filtros.
- O arquivo usa a lista já filtrada na tela — se houver filtro ativo, o Excel respeita.
- Uma aba "Encomendas" com uma linha por item, colunas:
  - Data, Cliente, Modelo, Cor, Tamanho, Qtd., Valor dos itens, Valor recebido, Cupom, Brinde, Status (Pago / Aguardando pagamento / Estornado), Resumo do pedido.
- Uma aba "Resumo" com: período filtrado (ou "Tudo"), total de itens, total de peças, total recebido e data/hora da geração.
- Nome do arquivo: `encomendas-AAAA-MM-DD_AAAA-MM-DD.xlsx` (ou `encomendas-completo.xlsx` sem filtro de data).
- Se não houver nada para exportar, mostra aviso "Nada para exportar" em vez de baixar arquivo vazio.

## Detalhes técnicos
- Usar a biblioteca `xlsx` (já usada em `src/lib/relatorioPontoExport.ts`) — sem nova dependência.
- Novo arquivo `src/lib/encomendasExport.ts` com a função `exportarEncomendasXLSX(linhas, { de, ate })`, seguindo o padrão do relatório de ponto (valores em R$ formatados, datas em pt-BR).
- Em `src/components/loja/EncomendasTab.tsx`: importar a função, adicionar o botão na barra de filtros (desabilitado enquanto carrega), chamando com `filtradas` e o período atual.
- Sem mudanças no banco, sem migração, sem mexer em Pedidos/Promoções ou outras telas.

## Validação
- Build sem erros.
- Conferir no preview: exportar sem filtro e com filtros (data + modelo), abrir o arquivo e verificar colunas, subtotais coerentes e nome do arquivo.
