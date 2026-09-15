# Aviso interno de compras na Loja

Toda compra paga na Loja passa a gerar também um e-mail para **fortemtreinamento@gmail.com**, além do e-mail já enviado ao cliente.

## Como vai funcionar

- O aviso é disparado no mesmo momento da confirmação atual: pagamento no cartão, pagamento no Pix e pedidos 100% cobertos por cupom.
- Conteúdo do aviso interno:
  - Nome, e-mail, telefone e CPF (mascarado) do comprador
  - Indicação de aluno vinculado, quando o pedido veio do Portal
  - Itens: produto, cor/tamanho, quantidade e valor
  - Cupom aplicado e desconto, quando houver
  - Brinde escolhido, quando houver
  - Forma de pagamento (cartão com parcelas, ou Pix) e valor final recebido
  - Marcação de encomenda, quando o pedido tiver itens sob encomenda
  - Número do pedido e data/hora
- Assunto: "Nova compra na Loja - <nome do cliente> - R$ <valor>".
- Se o envio interno falhar, o e-mail do cliente continua valendo normalmente (falha só registrada no log, sem quebrar o pedido).

## Detalhes técnicos

- Alterar apenas `supabase/functions/loja-enviar-confirmacao-email/index.ts`: após o envio ao cliente, montar um segundo HTML (layout administrativo simples) e enviar pelo mesmo SMTP já usado (`contatofortem@gmail.com` / `GMAIL_APP_PASSWORD`).
- Ampliar o `select` do pedido para incluir telefone, cpf, `aluno_id`, cupom/desconto, parcelas e `brinde_escolhido` (conforme colunas existentes em `pedidos`).
- Envolver o envio interno em try/catch próprio; nenhuma alteração nos chamadores (`loja-criar-pedido`, `loja-cobrar-pedido`, `pix-webhook`).
- Publicar a função e rodar typecheck.
