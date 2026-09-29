# Rafaela Lima Oliveira — Pagamentos sem o plano ativo

## O que encontrei no banco
- 23/09: venda do Start (R$ 100,00, paga no cartão) criou o plano de 28/09 a 27/10 e o contrato certo, com a mensalidade de 28/09 paga.
- Esse plano foi gravado com "próxima renovação" = 28/09 (o próprio dia de início), quando deveria ser 28/10.
- 28/09 às 00h: a renovação automática viu essa data, "renovou" o plano no mesmo dia e **encerrou o contrato certo**. Nenhum contrato novo ficou no lugar.
- 29/09 às 00h: a renovação rodou de novo e criou mais um plano Start e uma venda de R$ 579,00 marcada como paga (é o plano que aparece em Plano/Serviços), também sem contrato.
- Por isso a aba Pagamentos mostra o contrato encerrado, e a baixa do Histórico não aparece nela.
- O mesmo padrão (um plano novo por dia) aconteceu com ela em julho: 5 planos criados em 5 dias seguidos. Ou seja, é uma falha da renovação, não só um caso isolado.

## O que será feito
1. **Investigar a causa exata antes de mexer** na renovação automática: por que a venda gravou a próxima renovação igual ao início e por que a rotina renova o mesmo aluno em dias seguidos. Vou mostrar o resultado a você antes de corrigir.
2. **Corrigir a renovação** para que:
   - nunca renove um plano no mesmo dia em que ele começa (próxima renovação sempre = início + 1 mês);
   - nunca crie um segundo plano/venda para o mesmo aluno e o mesmo período;
   - nunca encerre um contrato vigente sem deixar outro no lugar.
3. **Listar outros alunos afetados** (contrato encerrado pela renovação sem contrato ativo substituto, ou planos repetidos) — só a lista, sem alterar nada.
4. **Corrigir a Rafaela** (só depois da sua resposta abaixo): reativar o contrato de 28/09 a 28/10, ligar a ele o plano ativo, desativar os planos duplicados e manter uma única mensalidade paga de 28/09.
5. Conferir no banco e na aba Pagamentos do perfil dela.

## Valores confirmados para a Rafaela
- 28/09 a 28/10: **R$ 100,00** (a venda de 23/09, já paga). Esse é o contrato que volta a ficar ativo.
- A venda de R$ 579,00 criada por engano em 29/09 (marcada como paga para o mesmo mês) será removida.
- A partir de 28/10: mensalidade de **R$ 579,00**. O plano fica com próxima renovação em 28/10 e valor de R$ 579,00, para que a renovação de 28/10 e as seguintes saiam com esse valor.
- Nada é enviado à Rede nem cobrado no cartão.

## O que NÃO será feito
- Nenhuma cobrança ou estorno no cartão; cron 28 e cobrança automática continuam desligados.
- Nenhuma alteração em outros alunos sem sua aprovação.

## Detalhes técnicos
- Aluno b2346cf1; contrato certo d0e1123e (plano fdc941e5, encerrado em 28/09 03:00 pelo `fn_auto_criar_contrato_ciclo`); planos c19ce033 (28/09, inativo) e 4ad8d891 (29/09, ativo, venda 03b25a4f R$ 579).
- `renovar-planos-mensais` seleciona `proxima_renovacao <= hoje`; `fdc941e5.proxima_renovacao = data_inicio`. Verificar `fn_planos_autorenew_defaults` / fluxo de venda e a guarda de 20h da função (não impediu repetição diária).
- `fn_auto_criar_contrato_ciclo` hoje encerra contratos antes de validar inserção; revisar a ordem e a guarda de contrato vigente.
