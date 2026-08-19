# Editar datas de frequência no Portal do Aluno

O aluno passa a poder corrigir o próprio histórico direto no painel "Histórico de Treinos": registrar um treino que ele fez mas esqueceu de concluir, e corrigir a data de um treino já registrado.

## Como vai funcionar

No bottom sheet "Histórico de Treinos", cada quadradinho da grade vira clicável:

- **Quadrado pendente ("—")**: abre uma lista com os dias de treino agendados no passado que ainda não têm sessão registrada. O aluno escolhe o dia (ex.: 14/07) e a sessão é criada naquela variação (T1, T2...), aparecendo em verde com a data.
- **Quadrado já realizado (ex.: 12/08)**: abre a mesma lista para trocar a data, mais a opção "Remover registro" caso tenha marcado errado.

Regra combinada: só aparecem datas em que existe agendamento de treino do aluno. Sem agendamento naquele dia, a data não pode ser escolhida — evita registros inventados. Se não houver nenhuma data elegível, a lista mostra uma mensagem explicando isso.

Ao registrar/mover, o agendamento correspondente é marcado como "realizado"; ao remover ou mudar de data, o agendamento antigo volta para "confirmado". Toda alteração mostra um aviso de confirmação antes de salvar e um toast de sucesso, e a barra de progresso / "sessão X de Y" da tela principal atualiza na hora.

Vale para o fluxo padrão de variações (T1–T4). Os modos 5-3-1, M102 e Plan Strong ficam fora desta entrega.

## Detalhes técnicos

- `src/pages/portal/PortalWorkouts.tsx`
  - Nova query `agendamentosElegiveis`: `treino_agendamentos` do aluno com `data <= hoje`, ordenados desc, limitados aos últimos ~90 dias.
  - Novo estado `editandoSlot: { variacao, sessaoId? } | null` e um sub-sheet de seleção de data que lista os agendamentos elegíveis (marcando os já usados por outra sessão como indisponíveis).
  - Ações:
    - criar: `insert` em `treino_sessoes` (`aluno_id`, `treino_id`, `variacao`, `data`, `concluido_em` = data escolhida 12:00, `agendamento_id`, `foi_troca` conforme a ordem esperada);
    - editar: `update` de `data`, `concluido_em`, `agendamento_id`;
    - remover: `delete` da sessão.
  - Sincroniza `treino_agendamentos.status` ("realizado" no novo dia, "confirmado" ao liberar o antigo).
  - Invalida `portal-treino-sessoes` e `portal-progress` após cada operação.
- Sem SQL: as políticas RLS de `treino_sessoes` e `treino_agendamentos` já permitem ALL para o próprio aluno (`aluno_id = fn_current_aluno_id()`).
