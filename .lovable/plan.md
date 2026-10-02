# Sessão de Reabilitação da Bruna Meyer (18/09 08:00) sumida da Agenda

## O que aconteceu (confirmado no banco)

- Em 12/08 foram criados os horários de Reabilitação da Bruna (sextas 08:00 etc.), cada um consumindo 1 crédito.
- O horário de **18/09 08:00 ainda existe**, mas em **11/09 foi editado na Agenda e o aluno foi retirado** (o campo aluno ficou vazio). Por isso a Agenda mostra o horário como vaga livre, enquanto o histórico de créditos dela continua mostrando o consumo.
- O mesmo aconteceu com outros dois horários dela, editados pelo mesmo usuário: **04/09 08:00** (editado em 01/09) e **09/09 09:00** (editado em 09/09). Nesses dois já havia presença marcada para ela.
- Ao tirar o aluno pela edição, o crédito **não foi devolvido** — fica consumido sem sessão vinculada.

## Correções

### 1. Restaurar os dados
Revincular a Bruna aos três horários (18/09, 04/09 e 09/09), para que voltem a aparecer na Agenda com o nome dela. Nenhum crédito é alterado: o consumo de cada um já está registrado.

### 2. Evitar que se repita
No formulário de edição da Agenda, quando um horário com aluno vinculado for salvo sem aluno:
- pedir confirmação ("Remover Bruna Meyer deste horário? O crédito será devolvido");
- ao confirmar, devolver o crédito consumido (igual ao que já acontece ao excluir o horário) e avisar com uma mensagem;
- se o aluno ficou vazio sem querer (ex.: a lista de alunos ainda não carregou), manter o aluno anterior em vez de apagar.

## Detalhes técnicos

- Dados: `UPDATE agenda_servicos SET aluno_id='b7f99527-…', credito_origem='plano'` nos ids `8cdc8c56-…`, `1a2c8019-…`, `1306bad8-…` (sem novo débito — verificar que o trigger de débito só age em INSERT/troca de aluno; se agir no UPDATE, desativar a duplicação pontual ou ajustar com movimento compensatório).
- `src/components/agenda/AddAgendaDialog.tsx` (ramo `isEditing` de avulso): se `editEvent.aluno_id` existe e `alunoId` vazio → `confirm`; ao confirmar, chamar `fn_agenda_estornar_credito_por_agenda` (ou equivalente usado na exclusão); invalidar `creditos-aluno`.
- Sem mudanças de schema.
