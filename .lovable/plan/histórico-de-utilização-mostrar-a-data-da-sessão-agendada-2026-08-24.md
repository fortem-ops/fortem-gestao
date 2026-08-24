# Histórico de utilização: mostrar a data da sessão agendada

## O que está acontecendo

No histórico de créditos, cada linha mostra hoje o campo de registro do movimento — o instante em que o lançamento foi feito no sistema. Exemplo real: um consumo de Reabilitação lançado em 24/08 refere-se a uma sessão agendada em 19/08 (com presença confirmada em 19/08). A tela exibe 24/08, o que confunde.

## O que será feito

1. **Data exibida = data da sessão**
   - Para movimentos vinculados a uma agenda, mostrar a data específica do agendamento na Agenda de Serviços; quando houver presença confirmada, usar a data da presença.
   - Também mostrar o horário de início da sessão ao lado da data, quando disponível.

2. **Fallback claro**
   - Movimentos sem agenda vinculada (compra, ajuste, lançamento manual) continuam mostrando a data do registro.
   - Ao lado das linhas de agenda, exibir em texto menor "lançado em dd/mm" para preservar a rastreabilidade do momento do registro.

3. **Ordenação por data da sessão**
   - A lista passa a ser ordenada pela data efetiva exibida (mais recente primeiro), para que a sequência de sessões faça sentido cronológico.

4. **Selo de presença**
   - Quando a presença estiver confirmada na agenda, exibir um selo "Presente" na linha; quando não houver registro de presença, nenhum selo extra.

## Detalhes técnicos

- `src/components/student/StudentServicos.tsx`, componente `CreditoHistorico`:
  - após carregar os movimentos, coletar os `agenda_id` não nulos e buscar em lote `agenda_servicos` (`data_especifica`, `horario_inicio`, `atividade`, `local`) e `agenda_presencas` (`data`, `comparecimento`) filtrando por esses ids;
  - montar um mapa `agenda_id -> { dataSessao, horario, presente }`, priorizando a data de presença confirmada e caindo para `data_especifica`;
  - a data renderizada passa a ser `dataSessao ?? m.data`; ordenação recalculada no cliente sobre essa data efetiva.
- Sem alterações de banco, RLS, triggers ou regra de negócio — apenas leitura adicional e apresentação.
