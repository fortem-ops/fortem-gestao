# WhatsApp não dispara ao vincular aluno em horário existente

## O que foi encontrado

O agendamento da Fabiane (Reabilitação, segunda 17:30) não gerou reserva avulsa: o aluno foi gravado **dentro da própria vaga fixa** (registro criado em 06/08, alterado hoje às 12:17 SP). Não há nenhum registro no log de disparos de WhatsApp para esse horário.

Causa no código (`AddAgendaDialog.tsx`): quando o salvamento entra no caminho de **edição** e não cai no caso específico "vaga fixa + data da célula", a função de salvar **não retorna nada**. Sem retorno, o `onSuccess` considera que não houve novo agendamento e simplesmente não chama o disparo de WhatsApp nem o e-mail. Ou seja: qualquer vinculação de aluno feita por edição de um horário já existente (fixo sem data de célula, ou avulso livre que recebe um aluno) fica silenciosa.

## O que vai ser feito

1. **Sempre retornar o registro salvo na edição**, com a informação de qual era o aluno antes.
2. **Disparar WhatsApp e e-mail também na edição** quando o horário passa a ter um aluno que antes não tinha (ou muda de aluno) — mesmo caminho de evento `agendamento_criado` já usado na criação.
3. **Fechar a brecha da vaga fixa sem data**: se o usuário abrir uma vaga fixa fora do contexto de um dia específico e vincular um aluno, o sistema não deve gravar o aluno no modelo fixo. O campo de aluno já é bloqueado nessa situação; será reforçada a regra no salvamento (modelo fixo nunca recebe aluno), evitando repetir o caso da Fabiane.
4. **Feedback visível**: se o disparo falhar, mostrar aviso ("agendamento salvo, mas o WhatsApp não foi enviado") em vez de falhar apenas no console.
5. **Corrigir o dado atual da Fabiane**: transformar o vínculo indevido na vaga fixa em uma reserva avulsa de hoje (10/08, 17:30, Reabilitação), com exceção no modelo fixo para não duplicar a vaga do dia, e a vaga fixa volta a ficar livre nas próximas semanas. O disparo de WhatsApp desse agendamento será enviado manualmente pela função de disparo após a correção.

## Detalhes técnicos

- `src/components/agenda/AddAgendaDialog.tsx`
  - `mutationFn`: no ramo `isEditing`, buscar/retornar o registro atualizado (`.update(...).select().single()`) junto com `alunoAnterior` (de `editEvent.aluno_id`); forçar `aluno_id: null` sempre que `editEvent.tipo === "fixo"`.
  - `onSuccess`: calcular `deveDisparar = novoRegistro || (registro.aluno_id && registro.aluno_id !== alunoAnterior)` e usar essa condição para `whatsapp-disparo-agenda` (`agendamento_criado`) e `notify-agenda-evento`.
  - Tratar erro/retorno do `functions.invoke` com `toast.warning`.
- Correção pontual dos dados via inserção/ajuste no banco (reserva avulsa + exceção + limpar `aluno_id` do modelo fixo), e chamada da função `whatsapp-disparo-agenda` para o novo id.

Nenhuma mudança na lógica de cancelamento, créditos ou nos templates existentes.
