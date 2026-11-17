# Aba "Produtos" na Nova Venda

## O que a equipe vai ver
Uma terceira aba, **Produtos**, ao lado de Planos e Serviços, na Nova Venda do aluno.

1. **Escolher produtos**: lista dos produtos ativos da Loja, com foto, preço e estoque de cada tamanho/cor. Dá para pôr mais de um item e escolher a quantidade. Se o item não tem estoque, só entra quando estiver marcado na Loja como "aceita encomenda" (vira encomenda); senão fica bloqueado.
2. **Resumo e pagamento**:
   - Desconto em R$ ou % (como em Serviços) e cupom da Loja, se houver.
   - Formas de receber:
     - **Registrar**: Pix, dinheiro, cartão na maquininha, marcando "pago" ou "pendente".
     - **Cobrar online**: Pix com QR code na tela (baixa sozinho quando o aluno paga), ou cobrança no cartão salvo do aluno (Meios de Pagamento).
3. **Concluir**: o estoque baixa na hora em qualquer caso (pago ou pendente). Produto com estoque sai **entregue** no balcão. Encomenda fica na fila de Encomendas da Loja até chegar.

## Regras
- Preços sempre lidos da Loja no servidor; a tela não decide valor nem estoque.
- Venda cancelada ou estornada devolve o estoque (mesmo caminho do estorno da Loja que já existe).
- A venda aparece em "Compras na Loja" do aluno e na Loja > Pedidos, igual a um pedido do site.
- Clicar duas vezes em "Concluir" não cria dois pedidos nem baixa o estoque duas vezes.
- Cartão salvo: nunca cobra duas vezes; recusa mantém o pedido pendente para tentar de novo.

## Detalhes técnicos
- Nova função `fn_loja_venda_balcao(payload)` (só admin/coordenador/consultor via sessão): reaproveita a lógica de `fn_loja_criar_pedido` (preço, encomenda, `estoque_movimentos`), usa dados do aluno do cadastro, aplica desconto manual (limitado ao total) ou cupom, grava `forma_pagamento`, `idempotency_key`, status `pago` ou `aguardando_pagamento`, e marca `pedido_itens.entregue_em/entregue_por` nos itens com estoque.
- Pix online: chama a função existente `loja-criar-pix` com o `pedido_id` (QR + polling por `loja-status-pedido`).
- Cartão salvo: nova ação para a equipe na cobrança de pedido (ou adaptar `loja-cobrar-pedido` com caminho autenticado da equipe) usando `cartoes_salvos` do aluno, com trava de idempotência em `pagamentos_rede`.
- Front: `src/components/student/venda/VendaProdutos.tsx` + nova `TabsTrigger value="produtos"` em `VendaDialog.tsx`.
- Testes: cálculo de desconto (R$/% sem passar do total), bloqueio sem estoque vs encomenda, idempotência do pedido e baixa única do estoque.
