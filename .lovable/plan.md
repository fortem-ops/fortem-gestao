# Grade semanal por horário de início, com atividades lado a lado

Hoje a grade da Agenda de Treinos cria uma linha para cada combinação de início+fim e guarda apenas **um** slot por dia/horário. Por isso, ao cadastrar TREINO às 07:30 no mesmo dia em que já existia CORRIDA às 07:30, a Corrida sumiu da tela (foi sobrescrita) e horários com durações diferentes viram linhas separadas.

## Como vai ficar

- Uma linha por **horário de início** (07:30, 08:00, 08:30...), ordenadas cronologicamente. A duração deixa de dividir a linha; o fim aparece dentro do card de cada atividade.
- Em cada célula (dia × horário) podem aparecer **vários cards empilhados**, um por atividade — ex.: TREINO e CORRIDA às 07:30 na segunda, ambos visíveis.
- Cada card mantém ocupação (x/y), etiqueta da modalidade (Treino em verde/primário, Corrida em laranja), instrutor, marca "off" quando inativo, e o tooltip com os alunos agendados.
- Clique em cada card continua abrindo o painel de detalhes daquele horário específico.

Nada muda no banco nem na criação de horários — é só a leitura/exibição da grade.

## Detalhes técnicos

Arquivo: `src/pages/AgendaTreinos.tsx`, componente `WeeklyGrid`.

- `rows`: chavear apenas por `horario_inicio` (sem `horario_fim`), ordenado por `toMinutes`.
- `slotIndex`: passar de `Map<string, Slot>` para `Map<string, Slot[]>` com chave `dia|horario_inicio`, acumulando (push) em vez de sobrescrever; ordenar cada lista por modalidade e depois por `horario_fim`.
- Na célula: renderizar `flex flex-col gap-0.5` com um botão/Tooltip por slot da lista; célula vazia mantém o "·".
- O rótulo da coluna de horário mostra só o início (o fim vai para o card, ex.: "→ 08:30").
