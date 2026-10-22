# Plano 2 — Pix Automático no checkout /planos (Start, Power e Pro 2027)

Só plano. Nada é implementado, publicado ou ligado sem aprovação do dono, etapa por etapa. Os itens E4–E6 do Plano 1 continuam fora. O cartão, a recorrência no cartão e o cron `planos-recorrencia-diario` não mudam.

## Premissas (corrigidas quando necessário)
- A conta Inter só aceita a **jornada 2**: um QR autoriza a recorrência e não cobra nada. A jornada 3 não existe para nós e não é usada aqui.
- Cada cobrança mensal precisa ser criada no Inter **pelo menos 2 dias antes** do vencimento. A política de retentativa é PERMITE_3R_7D.
- Taxa de R$ 24,90 igual à do cartão. O valor de cada mês sai de `calcularVenda2027`, o mesmo cálculo do cartão; o servidor recalcula sempre.
- Hoje o /planos já cobra **Pix à vista** (cobrança imediata com baixa por aviso do banco e consulta de reserva) e já tem o cronograma de mensalidades 2027 (`planos_2027_mensalidades`), que gera as cobranças espelho por gatilho.

## 1. O que o cliente vê
1. Na escolha da forma, aparece "Pix Automático (débito mensal no seu banco)" ao lado de "Cartão — recorrência", só quando a liberação está ligada para aquele plano.
2. Contrato e aceite seguem como hoje.
3. Na tela de pagamento, em dois passos numerados:
   - **Passo 1, pagar o 1º mês:** QR e copia e cola de um Pix comum no valor do 1º mês, igual ao do cartão. É o mesmo Pix à vista que já funciona e vale 30 minutos.
   - **Passo 2, autorizar os próximos meses:** depois do pagamento, aparece o QR de autorização. O cliente lê no app do banco e confirma. O texto diz que nada é cobrado nesse momento.
4. Enquanto espera, a tela mostra "Aguardando confirmação do banco" e consulta o servidor a cada 8 segundos. O servidor lê primeiro o banco de dados (preenchido pelo aviso do Inter) e só pergunta ao Inter como reserva, no máximo a cada 30 segundos.
5. **A aprovação da autorização** chega pelo aviso do Inter. A recorrência passa a APROVADA e o cronograma ganha o meio "Pix Automático".
6. **Se não autorizar ou o código expirar:** o plano já está ativo, porque o 1º mês foi pago. A tela permite "Gerar novo código de autorização", com até 3 códigos por proposta. O cliente recebe um e-mail com o link para voltar a esta etapa. Sem autorização até 10 dias antes do 2º vencimento, a equipe recebe um aviso ("autorização pendente") para resolver no balcão ou trocar para cartão.
7. **Se o cliente cancelar depois no banco:** o aviso do Inter marca a recorrência como CANCELADA. As mensalidades futuras ficam "sem meio de cobrança" e a equipe é avisada, como numa recusa do cartão. O cliente pode autorizar de novo por um link da equipe.

## 2. Primeiro mês: opções
| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| A (recomendada) | Pix comum do 1º mês primeiro; autorização depois do pagamento | Reaproveita o Pix à vista já testado; acesso liberado na hora; não há como cobrar o 1º mês duas vezes, porque o cronograma começa no 2º mês | Dois QR em sequência; o cliente pode parar antes de autorizar (coberto pelo aviso do item 1.6) |
| B | Autorização primeiro e 1ª cobrança pela recorrência | Um único meio | O Inter exige 2 dias de antecedência: o acesso atrasa 2 ou 3 dias ou o aluno entra sem pagar; mais risco |
| C | Os dois QR na mesma tela | Rápido para quem entende | Confuso, com risco de pagar e não autorizar sem perceber; mesmo backend da A |

**Recomendação: opção A.**
- 1º mês: o mesmo valor do cartão (mensalidade + R$ 24,90 + desconto recorrente do Start, quando houver).
- A autorização nasce com início no 2º vencimento e valor mínimo igual ao da mensalidade.
- O cronograma é criado só depois da baixa do 1º mês, pelo mesmo caminho idempotente do cartão (uma linha por proposta e mês).

## 3. Meses seguintes
- **Nova rotina** `planos-pix-automatico-diario`, separada e sem tocar no cron do cartão, roda 1 vez por dia às 10:30 UTC (07:30 Brasília).
- **Antecedência:**
  - cria no Inter a cobrança de toda mensalidade Pix Automático com vencimento entre **5 e 3 dias** à frente;
  - quem ficar a 2 dias ou menos não é criado: a equipe recebe o aviso "cobrança Pix não agendada".
- **Sem duplicidade:**
  - uma reserva atômica por mensalidade, com a chave da cobrança gerada antes de chamar o Inter e gravada na mensalidade;
  - se o resultado for incerto, a mensalidade fica "desconhecido" e é conferida pela chave, nunca recriada;
  - uma cobrança por mensalidade, garantida no banco.
- **Power e Pro:** as 12 mensalidades já nascem no cronograma.
- **Start:** a próxima só nasce quando a atual é paga, reaproveitando a regra de renovação 2027 do Start e o desconto recorrente.
- **Reaproveita:** `pix_recorrencias` e `pix_cobrancas` (com ligação à mensalidade), a criação de cobrança mensal que já existe em `_shared` e a baixa pelo `pix-webhook`.

## 4. Falhas
- **Débito recusado ou sem saldo:** o Inter tenta de novo por até 7 dias (PERMITE_3R_7D). Cada tentativa fica registrada. Depois disso, a mensalidade fica **em atraso** e o espelho em `cobrancas` vira inadimplência, como no cartão. A equipe recebe um aviso único por mensalidade.
- **Encargos de atraso:** só aparecem na tela (cálculo atual). Nada é cobrado (E4 fora).
- **Autorização cancelada pelo cliente:** ver item 1.7. As cobranças já criadas e não pagas são canceladas no Inter, sem custo.
- **Fim de semana ou feriado:** o vencimento continua na data do contrato. O Inter debita no dia útil seguinte e o atraso só conta depois do prazo das retentativas.

## 5. Ligação com o resto
- **Contrato e venda:** iguais aos da recorrência no cartão. A forma aparece como "Pix Automático", com o template de recorrência após a revisão do advogado.
- **Cobranças espelho, créditos (`ciclos_credito`), acesso e ficha:** pelos mesmos gatilhos e regras de mensalidade 2027 de hoje. O crédito do mês só é liberado com a mensalidade paga.
- **Baixa:** um passo idempotente chamado pelo aviso do Inter (cobrança CONCLUIDA) e pela consulta de reserva das 30 em 30 minutos. Ele marca a mensalidade como paga, e o espelho, o financeiro e a conciliação seguem o caminho de hoje.
- **O que a equipe vê:** na ficha, a forma "Pix Automático" com o estado (pendente, aprovada, cancelada) e as próximas cobranças.
- **O que a equipe pode fazer** (admin ou coordenação):
  - dar baixa manual, com motivo;
  - cancelar a autorização (já existe `pix-cancelar-recorrencia`);
  - gerar novo link de autorização;
  - trocar para cartão, encerrando as cobranças Pix futuras e mantendo as pagas.

## 6. Segurança e conformidade
- **Acionamento:** só o servidor cria cobranças e autorizações, sempre pelas liberações e pela proposta.
- **CPF:** o pagador é o titular da proposta. O CPF tem de bater com o da conta no banco, e a tela avisa isso antes do QR. Se o banco recusar por CPF, a mensagem é neutra e a equipe é avisada.
- **Logs:** CPF mascarado (`mascararCpf`), sem copia e cola nem chave nos registros.
- **Texto do checkout**, só o que precisa aparecer (a redação fica com o advogado):
  - autorização de débito mensal no banco, com valor, dia, quantidade de meses ou renovação mensal do Start;
  - como cancelar no app do banco e o que acontece com o plano se cancelar;
  - retentativas em até 7 dias e encargos em caso de atraso;
  - a taxa de R$ 24,90.
- **Consentimento:** caixa obrigatória "Li e autorizo o débito automático via Pix", com versão do texto guardada no aceite, como o anexo atual.

## 7. Liberação em fases
- Novas liberações, todas desligadas, com ausência contando como desligado: `planos_pix_automatico_ativo` e `planos_pix_automatico_planos` (lista: start, power, pro).
- **Ordem:**
  1. teste de ponta a ponta com o dono a R$ 1,00 no máximo, usando o teto de teste atual: Pix do 1º mês, autorização, uma mensalidade com vencimento a 3 dias, baixa e cancelamento;
  2. Start;
  3. Power;
  4. Pro.
  Cada um é ligado só com aprovação do dono.
- **Desligar rápido:** desligar a liberação esconde a opção na hora. Quem já autorizou continua sendo cobrado, a menos que o dono peça para pausar a rotina, que tem chave própria.
- **Medir:** autorizações aprovadas sobre geradas, cobranças pagas na 1ª tentativa, falhas por motivo e avisos à equipe, num relatório simples na tela de propostas.

## 8. Etapas
| # | O que muda | Migração | Função de borda | Publicar | Risco | Reverter | Esforço |
|---|---|---|---|---|---|---|---|
| P1 | Liberações e meio "pix_automatico" no cronograma, com ligação a recorrência e cobrança | Sim | Não | Não | Baixo | Script de volta | Baixo |
| P2 | Autorização após o Pix do 1º mês (servidor do checkout) e baixa da autorização pelo aviso do Inter | Sim (passos no banco) | `planos-checkout`, `pix-webhook` | Não* | Médio | Desligar liberação | Médio |
| P3 | Tela de pagamento em 2 passos, opção na escolha da forma e link de retomada | Não | Não | Sim | Baixo | Desligar liberação | Médio |
| P4 | Rotina `planos-pix-automatico-diario` (criar cobrança 5 a 3 dias antes, reserva, incerteza) | Sim | Nova | Não | Médio | Pausar a rotina | Médio |
| P5 | Falhas, atraso, avisos e ações da equipe na ficha | Sim | `pix-webhook` | Sim | Médio | Script de volta | Médio |
| P6 | Teste de ponta a ponta com o dono a R$ 1,00 | Não | Não | Não | Baixo | Cancelar no Inter | Baixo |
| P7 | Ligar Start, depois Power, depois Pro | Não | Não | Não | Médio | Desligar | Baixo |

*Funções de borda passam a valer assim que são republicadas, sem publicar o site. Telas só aparecem no site depois de publicado, e o dono publica.

Aprovação de ferramenta: as migrações e as chamadas reais ao Inter no teste. Criar a rotina diária usa uma consulta de dados com aprovação.

Dependências:
- **Advogado:** texto do item 6 e template de contrato "Pix Automático" (§5 e §6–§8).
- **Inter:** limites diários de cobranças recorrentes da conta, prazo real de retentativa e se o aviso de recorrência cancelada chega para nós (testado só na jornada 2).

## 9. Perguntas para o dono
1. A taxa de R$ 24,90 é por mês, como no cartão, ou só uma vez?
2. Sem autorização, o aluno segue ativo até o 2º vencimento (recomendado) ou fica bloqueado?
3. A antecedência de 5 a 3 dias está boa?
4. Quantas tentativas de novo código de autorização (sugestão: 3)?
5. Quem pode trocar o Pix Automático para cartão: admin e coordenação, ou só admin?
6. Quer o aviso ao cliente (e-mail) 3 dias antes de cada débito?
