# Botão "Cobrar" ao lado de "Dar baixa" (mensalidade avulsa no cartão)

## Situação confirmada no banco
- Mensalidade 1/12 — Power 2x, venc. 27/10/2026, R$ 453,90, cartão recorrente, **pendente**, nenhuma tentativa ainda.
- Venda manual 2027 (R$ 5.446,80 em 12x) criada hoje, também pendente. O aluno tem 2 cartões salvos.
- Já existe a cobrança de um clique com cartão salvo (a mesma janela "Pagar com cartão" do Histórico de Vendas), que para o 1º ciclo de venda manual já reserva, liquida e liga pagamento, cobrança, venda e ciclo sem duplicar.

## O que muda
1. Na lista de cobranças do contrato (aba Contrato do aluno), em cada mensalidade em aberto, aparece **"Cobrar"** ao lado de "Dar baixa" — só para administradores.
2. Ao clicar, abre a janela já existente de pagamento com cartão salvo (escolher cartão, confirmar). O valor vem sempre do servidor, nunca da tela.
3. Depois de aprovada, a mensalidade fica "Pago" com o TID; se recusada, mostra o motivo e continua em aberto. Nada é cobrado duas vezes: um segundo clique cai na trava de idempotência existente.

## Limite desta etapa
- O botão só aparece quando a mensalidade é o **1º ciclo de uma venda manual com cartão** (o caso de hoje), porque é o único caminho de cobrança avulsa já protegido. Para as mensalidades seguintes o botão fica oculto; cobrá-las avulsamente exige um caminho novo no servidor e plano próprio.
- Sem alteração em banco, cron, flags, site /planos ou Pix.

## Antes de cobrar de verdade
- Conferir por leitura que o servidor calcula R$ 453,90 (1 mensalidade, não o total) para esta venda recorrente e acha esta cobrança pelo vínculo do contrato. Se não bater, paro e reporto sem cobrar.
- A cobrança real da Mariana(o) só acontece quando você clicar; eu não disparo nenhuma cobrança.

## Detalhes técnicos
- `src/pages/alunos/ContratoFinanceiro.tsx`: botão `Cobrar` (ícone CreditCard) na lista `todas.map`, condição `podeCancelar && roles.isAdmin && aberta && numero_ciclo===1 && forma cartao_recorrencia/cartao_parcelado` + venda manual 2027 vinculada ao contrato (busca da venda pelo contrato/aluno+catalogo). Abre `PagarCartaoDialog` com `vendaId`, `alunoId`, `valor` exibido, `recorrencia`, `parcelasTotais`; `onSuccess` → `invalidarPagamentos`.
- Teste: um caso em teste existente garantindo que o botão não aparece para ciclo > 1 nem para cobrança paga.
