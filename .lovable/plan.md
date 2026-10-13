# Exportar Despesas em PDF e Excel

## Objetivo
Na aba **Financeiro > Despesas > Lançamentos**, adicionar um menu "Exportar" com opções **Excel (XLSX)** e **PDF**, gerando o arquivo com as despesas **exatamente como estão filtradas na tela** (período, base vencimento/pagamento, busca, categoria, fornecedor, tipo, status, forma, conta e conciliação).

## Como vai funcionar
- Botão "Exportar" (ícone de download) na barra de filtros, ao lado do contador "N lançamento(s) · R$ total". Visível para todos que veem a tela (inclusive modo somente leitura); desabilitado enquanto carrega.
- Se houver itens selecionados em lote, o export usa **somente os selecionados**; caso contrário, usa toda a lista filtrada.
- Se não houver nada para exportar, mostra aviso "Nada para exportar" em vez de baixar arquivo vazio.

### Colunas (nos dois formatos)
Vencimento, Pagamento, Descrição, Fornecedor, Categoria, Tipo (Fixa/Variável), Status (Pago/Pendente), Forma de pagamento, Conta, Parcela (ex.: 2/12), Valor, Valor pago, Conciliado (Sim/Não).

### Excel (.xlsx)
- Aba **"Despesas"**: uma linha por lançamento, valores em R$ formatados, datas em pt-BR.
- Aba **"Resumo"**: período exportado, base da data (vencimento/pagamento), filtros ativos, total de lançamentos, soma dos valores, soma dos valores pagos e data/hora da geração.
- Nome do arquivo: `despesas-AAAA-MM-DD_AAAA-MM-DD.xlsx`.

### PDF
- Cabeçalho padrão FORTEM (faixa verde, título "Despesas", período e data/hora de geração), igual ao relatório de ponto.
- Tabela em paisagem com as mesmas colunas (fonte reduzida para caber) e linha de **totais** ao final (valor e valor pago).
- Rodapé com numeração de páginas.
- Nome do arquivo: `despesas-AAAA-MM-DD_AAAA-MM-DD.pdf`.

## Detalhes técnicos
- Novo arquivo `src/lib/despesasExport.ts` com `exportarDespesasXLSX(linhas, meta)` e `exportarDespesasPDF(linhas, meta)`, reutilizando as bibliotecas já instaladas: `xlsx` (padrão de `relatorioPontoExport.ts`) e `jspdf` + `jspdf-autotable` (padrão de `pontoPdf.ts`, mesmo cabeçalho/rodapé).
- Em `src/pages/financeiro/Despesas.tsx`: importar as funções, montar o objeto `meta` (período, base, filtros) e adicionar o menu de exportação na barra de filtros, usando o componente de dropdown já existente (`ExportarRelatorioMenu` ou equivalente).
- Sem mudanças no banco, sem migração, sem mexer em outras telas do Financeiro.

## Validação
- Build sem erros.
- Conferir no preview: exportar sem filtro e com filtros (período + categoria + busca), com e sem seleção em lote; abrir os dois arquivos e verificar colunas, totais coerentes e nomes dos arquivos.
