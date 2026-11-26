# Editar horário: "só este dia" ou "este e os próximos"

## O que muda para a equipe
Ao clicar em **Salvar** na janela **Editar horário**, aparece uma pergunta:
- **Somente neste dia (dd/MM)** — a mudança vale só para a data escolhida; as demais semanas seguem como estão.
- **Este e os próximos** — a mudança vale a partir dessa data para todas as semanas seguintes (como funciona hoje).

Quando a edição é aberta a partir da grade semanal, a data vem do dia clicado. Quando é aberta pela lista de horários fixos (sem data), a pergunta pede para escolher a data (sugere a próxima ocorrência).

Na grade, um horário alterado só para um dia ganha um pequeno selo "Alterado neste dia". Alunos com reserva nesse horário/dia mantêm a reserva.

## Regras
- "Só este dia" pode mudar: início, fim, capacidade, instrutor, modalidade e observações. Não pode mudar o dia da semana (o campo fica travado nessa opção).
- Se a nova capacidade for menor que as reservas já feitas naquele dia, a tela avisa e não salva.
- "Este e os próximos" altera o horário fixo; exceções de dias futuros já criadas continuam valendo.

## Detalhes técnicos
- Hoje `treino_slots` é só um modelo semanal (dia_semana + horário), sem ajuste por data. Será criada a tabela `treino_slot_excecoes` (slot_id, data, horario_inicio, horario_fim, capacidade_maxima, instrutor_id, modalidade, observacoes; único por slot+data), com GRANT + RLS (equipe edita; aluno autenticado lê).
- Primeiro passo: mapear onde os horários são lidos para exibir e reservar (grade da equipe em `AgendaTreinos.tsx`, portal do aluno e funções de reserva/capacidade no banco) e fazer todos aplicarem a exceção da data.
- `SlotDialog` recebe a data de origem opcional; nova confirmação (AlertDialog) com as duas opções; salvamento faz upsert na exceção ou o update atual.
- Testes de regressão: exceção vale só na data; "próximos" altera o modelo; capacidade abaixo das reservas é recusada; aluno vê o horário ajustado. Regra registrada no AGENTS.md da área.
