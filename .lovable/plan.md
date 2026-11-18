# Vendas de produtos no Histórico e baixa posterior

## O que encontrei
- A venda da Juliana foi gravada: R$ 80,00, pendente, criada hoje às 08:48. Ela aparece em Loja > Pedidos e em "Compras na Loja".
- O Histórico de Vendas da ficha só mostra planos e serviços. Por isso a venda de produto não aparece lá.
- Hoje, para deixar uma venda pendente, é preciso escolher a forma de pagamento antes de receber.
- Já existe em Loja > Pedidos o botão "Dar baixa", que pergunta a forma de pagamento na hora de receber.

## O que muda
1. **Histórico de Vendas mostra produtos:** as vendas da Loja daquele aluno entram na mesma lista, com o selo "Produto", os itens, o valor, a situação (Pago / Pendente / Cancelado) e a data.
2. **Pendente sem forma de pagamento:** na aba Produtos, ao escolher "Pendente", o campo de forma de pagamento some. A forma só é obrigatória em "Já recebido".
3. **Dar baixa depois:** venda de produto pendente ganha o botão **"Dar baixa"** no Histórico de Vendas. Ele abre a mesma janela da Loja: você escolhe a forma recebida (Pix, dinheiro, maquininha...) e a venda vira paga. O estoque não muda, porque já foi baixado na venda.
4. A venda da Juliana já aparece no Histórico assim que isso entrar no ar, e você pode dar a baixa por lá.

## Detalhes técnicos
- `HistoricoVendas.tsx`: nova consulta a `pedidos` + `pedido_itens` por `aluno_id`, linhas mescladas por data; botão abre `DarBaixaPedidoDialog` quando o status é `aguardando_pagamento`; invalida `compras-loja-aluno` e a lista.
- Migração: `fn_loja_venda_balcao` só exige `forma_pagamento` quando `pago = true`; pendente grava forma nula.
- `VendaProdutos.tsx`: esconde o seletor de forma quando o status é Pendente e não o envia.
- Testes: pendente sem forma é aceito, pago sem forma é recusado, regra de quais pedidos mostram "Dar baixa". Rodar a suíte completa e o eslint.
