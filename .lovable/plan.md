# Plano 2 (revisão 2): Pix Automático no checkout /planos (Start, Power e Pro 2027)

Este documento é só um plano. Nada é implementado, publicado ou ligado sem a aprovação do dono, etapa por etapa.

Ficam de fora:
- os itens E4–E6 do Plano 1;
- o e-mail ao cliente 3 dias antes do débito.

Não mudam: o cartão, a recorrência no cartão e o cron `planos-recorrencia-diario`.

## Decisões do dono (já incorporadas)
- **Taxa de R$ 24,90:** somada a cada mensalidade da recorrência (cartão e Pix Automático), por exemplo Power 2x = R$ 453,90. Não vale para o Start. A fonte única do valor continua sendo `calcularVenda2027`.
- **Opção A aprovada em princípio:** o 1º mês é pago com Pix comum e, depois, o cliente autoriza a recorrência, com início no 2º vencimento.
- **Sem autorização:** o aluno segue ativo até o 2º vencimento. A equipe recebe o aviso "autorização pendente" 10 dias antes.
- **Novo código de autorização:** no máximo 3 por proposta.
- **Trocar Pix Automático por cartão:** só admin, igual ao cancelamento de assinatura.

## A. Antecedência (regra oficial verificada)
Fonte: Guia de implementação do Pix Automático do Banco Central (v1.3) e a Instrução Normativa BCB 513/2024.
- A instrução de cobrança tem de chegar **entre 2 e 10 dias corridos antes** da data prevista para a liquidação. Os dias são corridos, não úteis. Fora dessa janela, o banco do pagador recusa, o que bate com o erro `CobROperacaoInvalida` que recebemos.
- **Dia útil:**
  - por padrão (`ajusteDiaUtil` ligado), o Inter passa a cobrança de dia não útil para o próximo dia útil;
  - os feriados considerados são os do município do pagador.
  - **Correção:** a cobrança do nosso teste foi criada com o ajuste desligado; no plano ele fica ligado.
- **Nova janela proposta:** a rotina diária cria a cobrança quando faltam **de 7 a 4 dias corridos** para o vencimento.
  - Isso dá 4 dias seguidos de chance antes do limite de 2 dias.
  - Como a regra é em dias corridos e o ajuste de dia útil só empurra a data para frente, não precisamos de calendário de feriados.
  - Faltando 3 dias, é a última tentativa. Com 2 dias ou menos, nada é criado e a equipe recebe o aviso "cobrança Pix não agendada".
- **Incertezas, a confirmar no 1º teste:**
  - se o Inter conta os 2 dias pela data de criação em horário de Brasília (vamos rodar às 10:30 UTC, 07:30 Brasília, longe da meia-noite);
  - se o Inter aplica o ajuste de dia útil exatamente como o guia descreve.

## B. Retentativas, atraso e créditos
- **Correção importante:** o Pix Automático **não tenta sozinho**. Cada nova tentativa é pedida por nós (`POST /cobr/{txid}/retentativa/{data}`):
  - até 3 tentativas, até 7 dias corridos após a data original (PERMITE_3R_7D);
  - nunca depois da véspera do ciclo seguinte;
  - pedidas até 23:59 da véspera de cada nova data.
- **Proposta para manter igual ao cartão:**
  - mesmas datas do cartão: D0 (data de liquidação, já com o ajuste de dia útil), D+1 e D+3;
  - D+1 e D+3 são pedidas pela mesma rotina diária assim que o Inter informar que D0 não foi paga;
  - as tentativas de D+4 a D+7 que a política permite não são usadas.
- **Atraso:** igual ao cartão. Sem pagamento após a tentativa de D+3, a mensalidade vira atraso e a cobrança espelho vira inadimplência. A equipe recebe um aviso por mensalidade.
- **Start:** a mesma tolerância de 3 dias. Sem pagamento até D+3, o crédito do mês não é liberado e a próxima mensalidade não nasce.
- **Pagamento tardio:** se o cliente pagar depois por Pix comum gerado pela equipe, a baixa libera o crédito, como no cartão.
- **Encargos:** continuam só na tela.

## C. Start e a regra "só recorrência"
- O Pix comum do 1º mês é **compatível com a regra**, desde que ele seja a 1ª mensalidade da própria recorrência, e não uma forma de pagamento à vista:
  - o contrato continua sendo de recorrência mensal;
  - a autorização é exigida logo depois do pagamento;
  - o Start não ganha desconto de à vista e o valor é igual ao 1º mês do cartão.
- **O que o advogado precisa ver no texto:**
  - a 1ª mensalidade é paga por Pix imediato e as seguintes por débito automático;
  - sem autorização até o 2º vencimento, o que acontece (aviso, troca para cartão, encerramento);
  - como cancelar a autorização e o efeito no plano;
  - as 3 tentativas em até 3 dias e os encargos;
  - a taxa de R$ 24,90 (só Power e Pro).
- **Alternativa, se o advogado vetar:** o Start no Pix Automático faria primeiro a autorização e o 1º débito sairia em 3 dias (mínimo de 2 dias corridos). O acesso seria liberado só com o débito pago. É mais seguro juridicamente, mas o aluno espera 3 dias para começar.

## D. Venda manual e ficha do aluno
- **Recomendação:** deixar a venda manual de fora até Start, Power e Pro estarem ligados no site e estáveis. Depois, uma etapa própria (P8), só admin:
  - gerar o link de autorização a partir de uma venda 2027 da equipe;
  - usar o mesmo cronograma e a mesma rotina.
- Na ficha, desde o início, a equipe vê o estado da autorização e das cobranças.
- **Ações:**
  - baixa manual: admin e coordenação, com motivo;
  - cancelar a autorização e trocar para cartão: só admin.

## 1. Fluxo do cliente
1. A opção "Pix Automático (débito mensal no seu banco)" aparece ao lado do cartão, só com a liberação daquele plano ligada.
2. Contrato e aceite seguem como hoje, com a caixa obrigatória "Li e autorizo o débito automático via Pix". A versão do texto fica guardada.
3. **Pagar o 1º mês:** com o Pix à vista que já existe, válido por 30 minutos, com baixa pelo aviso do Inter e consulta de reserva a cada 30 segundos.
4. **Autorizar:** depois da baixa, aparece o QR da jornada 2, que não cobra nada.
   - O pedido de autorização fica aberto no banco por até 30 dias; vamos usar 7 dias.
   - A tela consulta o servidor a cada 8 segundos e a aprovação chega pelo aviso do Inter.
5. **Se o código expirar ou o cliente não autorizar:** pode gerar um novo código, no máximo 3. O link de retomada segue no e-mail de confirmação que já é enviado, sem e-mail novo. O aviso à equipe sai 10 dias antes do 2º vencimento.
6. **Se o cliente cancelar no banco:** o banco dele cancela automaticamente os débitos futuros. Recebemos o aviso, a recorrência fica cancelada, as mensalidades futuras ficam "sem meio de cobrança" e a equipe é avisada.

## 2. Valores
- **1º mês e cada mensalidade:** iguais aos do cartão, vindos de `calcularVenda2027`. Isso inclui os R$ 24,90 no Power e no Pro e o desconto recorrente do Start.
- **Valor mínimo da autorização:** igual ao da mensalidade.
- **Sem cobrança dupla:** o cronograma começa no 2º mês e é criado de forma idempotente na baixa do 1º.

## 3. Meses seguintes
- **Rotina nova `planos-pix-automatico-diario`**, separada do cartão, às 10:30 UTC:
  - cria as cobranças da janela de 7 a 4 dias;
  - pede as novas tentativas de D+1 e D+3;
  - confere as cobranças sem resposta.
- **Sem duplicidade:**
  - a chave da cobrança é gerada antes de chamar o Inter e gravada numa reserva atômica;
  - resultado incerto fica como "desconhecido" e é conferido pela chave, nunca recriado;
  - cada mensalidade tem no máximo uma cobrança.
- **Power e Pro:** 12 mensalidades no cronograma.
- **Start:** a próxima mensalidade só nasce quando a atual é paga, pela regra de renovação 2027 de hoje.
- **Baixa:** pelo `pix-webhook` e pela consulta de reserva das 30 em 30 minutos, num passo idempotente.

## 5. Ligação com o resto
Contrato, venda, cobranças espelho, `ciclos_credito`, acesso, ficha, financeiro e conciliação seguem o caminho da recorrência no cartão. O que muda é só o meio de cobrança, gravado na mensalidade. A baixa marca a mensalidade como paga e o espelho acompanha.

## 6. Segurança
- Só o servidor cria cobranças e autorizações.
- O CPF do titular da proposta tem de ser o da conta no banco; a tela avisa antes do QR. Recusa por CPF gera mensagem neutra e aviso à equipe.
- CPF mascarado nos registros, sem copia e cola e sem chave.

## 7. Liberação em fases (todas DESLIGADAS)
- **Liberações:** `planos_pix_automatico_ativo` e `planos_pix_automatico_planos` (ausente = desligado). A rotina tem chave própria para pausar.
- **Ordem:**
  1. teste de ponta a ponta com o dono, de no máximo R$ 1,00: 1º mês, autorização, uma cobrança, uma nova tentativa e cancelamento;
  2. Start;
  3. Power;
  4. Pro.
  Cada um é ligado só com aprovação do dono.
- **Desligar:** a opção some na hora. Quem já autorizou só para de ser cobrado se a rotina for pausada.
- **Medir:** autorizações aprovadas sobre geradas, pagas em D0, D+1 e D+3, atrasos e avisos.

## 8. Etapas
Cada etapa só começa com aprovação do dono.

| # | O que muda | Migração | Função de borda | Publicar site | Risco | Reverter | Esforço |
|---|---|---|---|---|---|---|---|
| P1 | Liberações e meio "pix_automatico" no cronograma | Sim | Não | Não | Baixo | Script de volta | Baixo |
| P2 | Autorização após o 1º mês e baixa da autorização | Sim | `planos-checkout`, `pix-webhook` | Não | Médio | Desligar | Médio |
| P3 | Opção na tela, os 2 passos e o link de retomada | Não | Não | Sim | Baixo | Desligar | Médio |
| P4 | Rotina diária (janela 7–4 dias, D+1 e D+3, reserva) | Sim | Nova | Não | Médio | Pausar | Médio |
| P5 | Atraso, avisos e ações da equipe na ficha | Sim | `pix-webhook` | Sim | Médio | Script de volta | Médio |
| P6 | Teste com o dono, R$ 1,00 | Não | Não | Não | Baixo | Cancelar no Inter | Baixo |
| P7 | Ligar Start, depois Power, depois Pro | Não | Não | Não | Médio | Desligar | Baixo |
| P8 (depois) | Pix Automático na venda manual, só admin | Sim | Sim | Sim | Médio | Desligar | Médio |

- **Publicar:** as funções de borda passam a valer ao serem republicadas. As telas só aparecem depois que o dono publicar o site.
- **Aprovações de ferramenta:** as migrações, a criação da rotina e as chamadas reais ao Inter no teste.

**Dependências:**
- **Advogado:** o texto do item C e o contrato de recorrência por Pix Automático.
- **Inter:**
  - limites da conta;
  - como conta os 2 dias pela data de criação;
  - se o endpoint de nova tentativa está liberado (nunca usamos);
  - se o aviso de autorização cancelada chega para nós.

## 9. Perguntas ainda abertas
1. Seguir com novas tentativas em D+1 e D+3, iguais ao cartão (recomendado), ou usar até 3 tentativas nos 7 dias?
2. Validade do código de autorização: 7 dias (recomendado) ou outro prazo?
3. Se o advogado vetar o Pix comum no Start: usar a alternativa do item C ou não oferecer Pix Automático no Start?
