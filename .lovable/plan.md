# Baixa manual de pedidos da Loja (pagamento presencial)

## Situação

O pedido da Luciani Ventura (R$ 80,00, encomenda de 15/09) está como "Aguardando pagamento", sem forma de pagamento — ela pagou em dinheiro, presencialmente. Hoje só o cartão e o Pix marcam o pedido como pago automaticamente; não existe baixa manual.

## O que será feito

Botão "Dar baixa" nas linhas de pedidos com status "Aguardando pagamento", disponível para Coordenação e Administração, nas abas **Pedidos** e **Encomendas** da Loja.

Ao clicar, abre uma confirmação com:
- nome do cliente, itens e valor do pedido;
- seleção da **forma de recebimento**: Dinheiro, Pix, Cartão de débito (máquina), Cartão de crédito (máquina), Boleto (mesma lista já usada na baixa de mensalidades);
- botão "Confirmar recebimento".

Ao confirmar:
- o pedido passa para "Pago" com a forma escolhida;
- o estoque continua baixado (a reserva vira venda), como acontece no pagamento por cartão;
- o pedido é vinculado ao cadastro do aluno quando o CPF bate com um aluno existente (mesma rotina já usada nos outros pagamentos);
- é disparado o e-mail de confirmação ao cliente e a cópia interna para fortemtreinamento@gmail.com;
- a lista é atualizada na hora e aparece um aviso de sucesso (ou de erro, se algo falhar).

Depois da baixa, o pedido passa a aceitar o "Estornar" já existente, e aparece normalmente nos valores recebidos de Encomendas.

## Detalhes técnicos

- Novo componente compartilhado `src/components/loja/DarBaixaPedidoDialog.tsx` usando `FORMAS_RECEBIMENTO` de `src/lib/formasRecebimento.ts` (campo `vendaForma` gravado em `pedidos.forma_pagamento`, coerente com o que `labelFormaPagamento` já exibe).
- Atualização direta em `pedidos` via cliente Supabase (a política `pedidos_admin_write` já permite escrita para `is_coordinator_or_admin`); sem migration, pois `pago` já é um status válido e não há novas colunas necessárias.
- Após o update: `supabase.rpc("fn_loja_vincular_aluno", { p_pedido_id })` e `supabase.functions.invoke("loja-enviar-confirmacao-email", { body: { pedido_id } })`, ambos em `try/catch` para não bloquear a baixa.
- Integração em `PedidosTab.tsx` e `EncomendasTab.tsx`, com invalidação de `loja-pedidos`, `loja-encomendas` e `compras-loja-aluno`.
- Nenhuma alteração nas edge functions de cartão/Pix nem na loja pública.
