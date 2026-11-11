# Teste real do Plano Semestral: causa raiz e correção

Nada é executado antes da sua aprovação.

## 1. Causa raiz da ativação que não aconteceu (confirmada no código)
- A função de cobrança `rede-cobrar-token` só segue o caminho certo da 1ª mensalidade (reserva, baixa da nº 1 e ativação do plano) quando a venda tem `origem = 'manual'` e cobrança em recorrência.
- A venda da Bruna tem `origem = 'teste_2027'`, porque na preparação de hoje eu coloquei a Bruna na lista de alunos de teste. Por isso a venda caiu no caminho genérico antigo (Loja/Corrida).
- O caminho genérico só grava `pagamentos_rede` como approved e muda a venda para `pago`. Ele não baixa a cobrança nº 1, então o gatilho do ciclo não roda: sem `fn_semestral_ativar_venda`, sem créditos, sem Bota, sem 1ª Avaliação e sem nº 2.
- Com `origem = 'teste_2027'`, a venda também não tem linha em `planos_2027_mensalidades`. Isso foi conferido: não há nenhuma linha da venda nessa tabela.
  - Bom: a cobrança automática de amanhã às 08:00 não tem o que cobrar.
  - Ruim: o caminho 2027 em cartão nunca foi montado para essa venda.
- Por que o ensaio da 4B não pegou: ele chamava as funções do banco direto e usava uma aluna fora da lista de teste (`origem = 'manual'`). Faltaram duas coisas:
  - nenhum ensaio passou pela escolha de caminho que a função de cobrança faz;
  - nenhum ensaio usou a origem `teste_2027`.
- A falha foi minha: a preparação mudou a origem sem conferir esse desvio.

## 2. E-mail de recusa com rótulo "Corrida"
- A recusa na tokenização (cartão final 9109) chega ao aviso sem venda e sem pedido.
- O aviso tenta adivinhar o contexto e trata qualquer venda não paga das últimas 2 horas como Corrida. Ele só conhece dois casos, Loja e Corrida, e o texto "Inscrição da Corrida" está fixo no código.
- Assim, a venda Semestral aberta virou "Corrida · Inscrição da Corrida".

## 3. Correção proposta (com testes de regressão)
- **Função de cobrança:** a decisão de caminho passa a olhar o tipo da venda, e não só a origem. Venda em recorrência com contrato Semestral ou 2027 manual, com origem `manual` ou `teste_2027`, sempre vai para o caminho da 1ª mensalidade. O caminho genérico passa a recusar venda em recorrência que tenha contrato com cobrança nº 1, em vez de baixar só a venda.
- **Venda Semestral de teste:** garantir que a gravação crie a linha nº 1 em `planos_2027_mensalidades` também para origem `teste_2027`, igual à venda manual. A marcação de teste continua (fora de relatórios, sem comissão, sem aviso).
- **Aviso de recusa:** passar a venda e o tipo (Plano Semestral) desde a tela até a tokenização. Na adivinhação, só usar o rótulo Corrida quando existir inscrição da Corrida ligada à venda; nos outros casos, usar o nome do item da venda (ex.: "Plano Semestral · Pro Semestral").
- **Testes:**
  - teste automático da regra de escolha de caminho (função pura extraída e usada pela função de cobrança): falha com o código de hoje e passa depois;
  - teste do rótulo do aviso de recusa;
  - ensaio revertido no banco com venda Semestral `teste_2027`: reserva, liquidação simulada, ativação, créditos, Bota, Avaliação e nº 2 criada uma vez.
- Rodar os testes, a checagem de tipos e o lint, e publicar a função de cobrança e a de aviso.

## 4. Caso da Bruna: recomendação
**Recomendo ir direto ao cancelamento e estorno hoje**, sem completar a ativação. Motivos:
- Completar a ativação exigiria mexer à mão na nº 1 e na mensalidade, o que é uma baixa manual em cima de um caminho que estava quebrado. Isso não prova o fluxo corrigido.
- O estorno de R$ 1,00 precisa sair hoje. Depois da correção, um novo teste de R$ 1,00 (com a sua aprovação) valida o fluxo de ponta a ponta.

Passos:
1. **Estorno total de R$ 1,00** pelo fluxo existente de estorno de venda pela Rede, só admin, pelo tid `11132611111619570246`. Conferir `pagamentos_rede` refunded, venda estornada e o comprovante.
2. **Encerrar o que ficou aberto:**
   - cobrança nº 1 pendente: cancelada;
   - contrato: cancelado, sem multa;
   - plano: continua inativo, com data de fim hoje;
   - crédito da Avaliação: continua inativo.
   Nada é apagado (opção a).
3. **Desligar o teste:**
   - apagar a chave `semestral_teste_real`;
   - tirar a Bruna da lista de alunos de teste;
   - Mastercard final 4715: desativar o cartão salvo se você quiser.
4. **Conferência final:**
   - comparar com a foto do antes;
   - os 4 itens e os 2 modelos seguem desligados;
   - nenhum outro aluno foi afetado.

Atenção:
- Como a venda foi paga, a regra do CPF bloqueia a Bruna para o Semestral. Para o novo teste depois da correção, será preciso liberar só a venda deste teste na conferência do CPF. Fica para a sua decisão.
- O estorno chama a Rede de verdade, então só roda com a sua aprovação deste plano.


## Situação em 11/11/2026
Teste real de R$ 1,00 aprovado e limpo. Pendentes: Etapa 5 (2ª Avaliação no 6º ciclo), Etapa 6 (upgrade Start→Pro), licença por atestado, texto jurídico dos 2 contratos, ligar a venda.
