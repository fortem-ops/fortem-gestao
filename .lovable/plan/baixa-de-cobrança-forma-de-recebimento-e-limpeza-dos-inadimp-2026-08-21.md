# Baixa de cobrança: forma de recebimento e limpeza dos Inadimplentes

## O que está acontecendo (verificado no banco)

1. **Coluna "Pagamento" no Histórico de Vendas** mostra `pendente` porque a venda foi lançada com modalidade "A definir/Pendente" — é a forma escolhida na venda, e ela nunca é atualizada quando a cobrança recebe baixa. O "Status" (Pago) vem de outro campo (status da venda). Ou seja: hoje o sistema não registra **como o dinheiro entrou de fato**.
2. **Dashboard > Inadimplentes**: o Enio (e outros 9 casos) aparecem como atrasados porque existem 10 inadimplências com status "aberta" cuja cobrança já está **cancelada** (contrato encerrado). Nenhuma inadimplência aberta aponta para cobrança paga — o problema é só com cobranças canceladas e com a falta de vínculo entre a baixa e a venda.

## O que será feito

### 1. Dar baixa passa a registrar a forma de recebimento
No diálogo "Dar baixa" (aba Pagamentos do aluno), o campo atual de gateway vira uma seleção clara de **Forma de recebimento** (Dinheiro, Pix, Cartão de débito, Cartão de crédito na maquininha, Cartão de crédito online, Boleto). Ao confirmar:
- grava a forma escolhida na cobrança (além de status pago, data e gateway);
- se a venda vinculada estiver com forma "pendente" (ou vazia), atualiza a forma da venda com a forma recebida e marca a venda como paga;
- mantém a regularização da inadimplência já existente.

O mesmo passa a valer para a baixa em lote e para o diálogo de registro de pagamento da tela de Contratos (seleção da forma obrigatória).

### 2. Rótulos mais claros na tela
- Cobranças: coluna "Meio" passa a se chamar **"Recebido via"**, e `pendente` é exibido como "A definir" em vez do texto cru.
- Histórico de Vendas: coluna "Pagamento" passa a se chamar **"Forma (venda)"**, com `pendente` exibido como "A definir", deixando explícito que é a forma combinada na venda e não a de recebimento.

### 3. Dashboard > Inadimplentes deixa de listar cobrança cancelada/paga
- O widget passa a ignorar inadimplências cuja cobrança esteja cancelada ou paga (filtro na consulta).
- Correção pontual dos dados: as 10 inadimplências abertas com cobrança cancelada serão encerradas (status "cancelada"), removendo o Enio e os demais do painel.

## Detalhes técnicos
- `src/pages/alunos/ContratoFinanceiro.tsx`: diálogo de baixa ganha select de forma; `handleBaixa` grava `forma_pagamento` na cobrança e propaga para `vendas` (via `cobranca_id`/`plano_id` do contrato) quando `forma_pagamento` é `pendente`/nulo, ajustando `status_pagamento`.
- `src/hooks/useContratos.ts`: `useRegistrarPagamento` e `useDarBaixaLote` recebem `formaRecebimento` e a persistem; `useInadimplenciasAbertas` filtra por status da cobrança relacionada.
- `src/components/financeiro/TimelineCobrancas.tsx`: campo de forma no `RegistrarPagamentoDialog`.
- `src/components/student/venda/HistoricoVendas.tsx` e coluna "Meio": rótulos e fallback "A definir".
- Data fix via ferramenta de dados (UPDATE em `inadimplencias`), sem alteração de schema.
