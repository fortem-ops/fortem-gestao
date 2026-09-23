# Quadro "Inadimplentes" no Início

## O que o quadro está mostrando

O quadro não está desatualizado: ele lê o banco na hora. Existem hoje 5 registros de inadimplência em aberto, cada um ligado a uma mensalidade marcada como "atrasada" e nunca paga no sistema:

| Aluno | Plano | Vencimento | Valor | Situação do contrato |
|---|---|---|---|---|
| Carla Cimone Portes Rodrigues | Start mensal | 11/07/2026 | R$ 579 | Encerrado em 11/08 |
| Patricia Tirelli Lena | Start mensal | 12/07/2026 | R$ 379 | Encerrado em 12/08 |
| Carolina Guerra Baião | Start mensal | 01/08/2026 | R$ 379 | Cancelado (ela tem outro contrato ativo) |
| Jean Rodrigues da Silva | Start+ recorrente | 04/08/2026 | R$ 379 | Encerrado em 04/09 |
| Gabrieli Lazzari Vieira | Start+ recorrente | 18/08/2026 | R$ 379 | Encerrado em 18/09 |

Os 5 são cartão recorrente e vencem no período em que a cobrança automática foi desligada. Nenhum tem mensalidade paga depois dessa. Pelo sistema, o dinheiro não entrou.

## Preciso da sua decisão (pode ser diferente por aluno)

- **A) Foi pago fora do sistema:** dou baixa na mensalidade como paga (forma de pagamento e data que você informar). A inadimplência fecha sozinha.
- **B) Não era devido** (contrato cancelado ou encerrado sem cobrança daquele mês): marco a mensalidade como cancelada, com o motivo. A inadimplência sai do quadro e o histórico fica guardado.
- **C) É dívida real:** deixo como está.

Sugestão: Carolina Guerra Baião provavelmente é B, porque o contrato foi cancelado e trocado por outro ativo. Para os outros 4, preciso saber se pagaram.

## Detalhes técnicos

- A fonte do quadro é `inadimplencias_view` com status 'aberta', e ele ignora cobranças pagas, canceladas ou isentas. A regra está certa, então não mexo no quadro.
- A = mesma baixa manual da tela do contrato (cobrança paga, tid nulo, venda propagada). B = cobrança cancelada, com o motivo na observação e a inadimplência como 'cancelada'. As duas são gravadas pelo executor de SQL, com a lista de ids conferida antes.
- Não toco na operadora de cartão, na cobrança automática nem na rotina que roda sozinha.
