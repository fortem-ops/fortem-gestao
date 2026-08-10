# Horário fixo é só a vaga — aluno sempre avulso

## O que aconteceu (confirmado no banco)

O registro da Laura (Reabilitação, 11:00, Sala de Reabilitação) é o **próprio horário-modelo fixo da grade** (criado em 06/08), que hoje às 11:36 foi **atualizado** ganhando `aluno_id` da Laura. Como o registro continua com `tipo = 'fixo'` e `dia_semana = 1`, ela passa a aparecer em **todas as segundas**.

Causa: ao clicar num card livre da grade, a Agenda abre o diálogo em modo **edição** do horário fixo. Ao escolher um aluno e salvar, o aluno é gravado dentro do modelo recorrente em vez de virar uma reserva daquela data.

Hoje é o único caso no banco (1 registro fixo com aluno).

## Regra a implementar

Horário fixo = apenas a vaga na grade. Aluno vinculado é **sempre** avulso, numa data específica — tanto pela recepção quanto pelo app.

## Correções

### 1. Agenda / diálogo (recepção)
- Ao clicar num card de horário **fixo** da grade, a ação com aluno deixa de editar o modelo: o salvamento cria uma **reserva avulsa** na data da célula clicada (dia/hora/atividade/local/profissional copiados do modelo) e registra uma **exceção** do modelo naquela data, para a vaga não aparecer duplicada.
- Editar um horário fixo continua possível para os dados da vaga (atividade, local, horário, profissional, visibilidade), mas o campo de aluno não grava mais no registro fixo.
- Na criação manual, escolher tipo **Fixo** desabilita o campo de aluno (hoje já é assim no lote com múltiplos horários; passa a valer também para um único horário fixo).
- Remoção/cancelamento da reserva avulsa apaga a exceção correspondente, devolvendo a vaga à grade.

### 2. Agendamento pelo app
Existem duas versões da rotina de agendamento no banco; só uma grava como avulso. A segunda (usada no fluxo de treino/serviço com profissional e horário) ainda copia o tipo do modelo — será ajustada para gravar avulso + exceção, igual à outra.

### 3. Dados existentes
Converter o registro da Laura para avulso na data correta e recriar o horário-modelo fixo de segunda 11:00 sem aluno, com exceção nessa data. **Confirme a data**: o agendamento foi para hoje, 10/08?

## Detalhes técnicos

- `src/pages/Agenda.tsx`: `handleEventClick` passa também a data da célula (`cellDate`) para o diálogo.
- `src/components/agenda/AddAgendaDialog.tsx`: no save, se `editEvent.tipo === 'fixo'` e há aluno selecionado → `insert` em `agenda_servicos` com `tipo='avulso'`, `data_especifica = cellDate`, e `insert` em `agenda_servicos_excecoes (agenda_id = editEvent.id, data_excecao = cellDate)`; o `update` do modelo passa a excluir `aluno_id`/`credito_origem`. No modo de criação fixo, `aluno_id` sempre `null`.
- Delete em `Agenda.tsx`: ao remover um evento avulso, apagar a exceção correspondente (mesmo dia/hora/profissional/atividade).
- Banco: ajustar `fn_agendar_servico(uuid, uuid, timestamptz, uuid, text)` para `tipo='avulso'` + exceção, e uma correção pontual de dados para o registro da Laura (migration).
- Sem mudança de schema.
