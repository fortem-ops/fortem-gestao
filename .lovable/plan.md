# Parcelas do cartão escolhidas na etapa final de pagamento

## O que muda (resumo)

A "Número de parcelas" deixa de ser escolhida no passo 5 (antes do cadastro e do contrato)
e passa a ser escolhida na tela de pagamento, depois do contrato aceito:

- **Passo 5 (Pagamento):** escolhe só a FORMA (cartão parcelado, recorrência, Pix). O cartão
  mostra "em até 12x no cartão · Total de R$ …" (sem quebra por parcela). O rodapé do celular
  idem. O resumo/revisão também diz "em até 12x".
- **Tela de pagamento final (após contrato):** o campo de parcelas fica ativo (1x a 12x),
  começando em 12x, com o valor de cada parcela calculado ao vivo (mesma regra: sobra na
  última). Vale tanto no cartão real (formulário da Rede) quanto na simulação da prévia.
- **Recorrência e Pix:** sem escolha de parcelas, como hoje.
- **O que fica registrado:** a parcela escolhida vai para a tentativa e daí para
  `pagamento_parcelas`, e a ativação/e-mail/venda usam esse valor
  (`coalesce(pagamento_parcelas, parcelas_plano)`). Contrato continua "em até 12x" (texto
  não muda) e a regra do vencimento (dia da compra, ajustado ao fim do mês) não muda.

## Servidor (migração — texto completo já em `scripts/parcelas-no-pagamento.PROPOSTA.sql`)

1. `fn_checkout_2027_pagamento_iniciar` ganha `p_parcelas int DEFAULT NULL` (1–12, só
   cartão parcelado). A conferência com a revisão deixa de comparar `parcelas_plano` quando
   a forma é cartão parcelado; total e forma continuam conferidos ao centavo; Pix e
   recorrência inalterados. Cai a assinatura antiga de 4 argumentos (REVOKE/GRANT
   preservados). Verifiquei contra o corpo em produção: a proposta casa com o atual.
2. `fn_checkout_2027_cartao_reservar` (cartão real) ganha o mesmo `p_parcelas` e repassa ao
   `pagamento_iniciar` — sem isso o cartão real não veria a escolha.
3. `fn_checkout_2027_email_dados`: linha única trocada para
   `'parcelas', coalesce(r.pagamento_parcelas, r.parcelas_plano, 1)` (CREATE OR REPLACE com o
   corpo atual e só essa linha; grants preservados).
4. Script de volta (`scripts/parcelas-no-pagamento.rollback.sql`) será completado com os
   corpos originais que capturei do banco antes de aplicar. Ensaio em transação e desfazer,
   como de padrão.

## Função publicada planos-checkout

- Ler `parcelas` do corpo (inteiro 1–12, opcional) e repassar como `p_parcelas` em
  `pagar_cartao` (simulação) e em `tokenizar_cartao` → `fn_checkout_2027_cartao_reservar`
  (cartão real). Pix não recebe parcelas. Sem mudar nada além disso.

## Telas

- `src/pages/PlanosPublico2027.tsx`: remove o select "Número de parcelas" do passo 5; textos
  do cartão e do rodapé do celular viram "em até 12x"; a proposta continua nascendo com
  `parcelas_plano: 12` (referência "até 12x"); nada mais muda (consultas seguem fora do
  site, simulação F2/F3 fica dormente e inalterada).
- `src/components/planos/CheckoutSite2027.tsx`: revisão (Passo 6) mostra "Cartão de crédito:
  em até 12x" no lugar do "12x de R$ …".
- `src/components/planos/PagamentoReservado2027.tsx` + `CartaoPagamento2027.tsx`: o select de
  parcelas fica ativo (1–12, começa em 12), recalcula o valor por parcela na hora e envia a
  escolha na cobrança (`pagar_cartao`/`tokenizar_cartao`).

## Testes e verificação

- Vitest: ajustar os testes que citam parcelas (ex. `checkoutReservado2027.test.ts`,
  `planosPublico2027.test.ts`) e adicionar: parcela enviada ao servidor 1–12 com falha fora
  da faixa; texto "em até 12x" no passo 5 e na revisão; valor por parcela recalculado ao
  trocar o select.
- Banco: ensaio da migração em transação e desfeito; conferir assinatura nova, chamada
  interna do `cartao_reservar` e grants.
- Playwright desktop e celular: passo 5 sem select; contrato; tela final com select ativo
  (12x → trocar p/ 6x → valores recalculam); recorrência e Pix intactos; prévia admin e
  fluxo público.
- Regressão de balcão, vendas antigas e estorno: nenhum código tocado, mas rodeio completo
  de Vitest (890+ testes) como de praxe.

## Execução e Publish

1. Completar rollback e testes → aplicar migração → publicar `planos-checkout` (eu publico).
2. Ajustes de tela + testes → você publica o app uma única vez no fim (acumula com tudo que
   está pendente).
3. Sem cobrança real, sem estorno, sem e-mail real, sem mexer em chaves/crons/flags, cartão
   real segue travado (só sob pedido, teto R$ 1, NICOLAS TESTE).

## Riscos

- Propostas antigas criadas com parcelas "12x" continuam funcionando: a tela final parte do
  valor gravado e permite trocar; quem já está aguardando pagamento não é afetado.
- O aceite do contrato não cita a parcela fixa (já verificado), então nenhuma re-assinatura
  é exigida por causa da troca.
- Enquanto a função publicada não estiver atualizada, o front novo não pode ir ao ar: por
  isso a função sai antes do seu Publish.
