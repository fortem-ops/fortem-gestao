# Vaga de Reabilitação duplicada em 12/08

## O que aconteceu (confirmado no banco)

A Bruna Meyer agendou pelo app o horário de Reabilitação de quarta às 10h. O agendamento criou um registro novo, mas com `tipo = 'fixo'` (copiado do modelo da grade) em vez de avulso. Consequências:

1. O horário-modelo da grade (quarta 10h) continua existindo sem aluno, então a Agenda mostra a vaga como **livre** no dia 12/08 — parece que "abriu um novo horário".
2. O agendamento da Bruna, por estar marcado como fixo em quarta-feira, tende a aparecer também em **outras quartas**, não só em 12/08.

Ou seja: não abriu horário novo, o agendamento é que foi gravado no formato errado e duplicou o card.

## Correções

### 1. Corrigir o agendamento pelo app (causa raiz)
Na rotina de agendamento de serviço do app do aluno:
- gravar a reserva como **avulsa** (data específica), nunca como fixa;
- registrar uma **exceção** no horário fixo original para aquela data, de modo que a vaga-modelo deixe de aparecer como livre naquele dia;
- ao cancelar o agendamento, remover essa exceção para a vaga voltar a ficar disponível.

### 2. Corrigir os dados já existentes
- Converter a reserva da Bruna (12/08, 10h) para avulsa.
- Criar a exceção correspondente no horário fixo de quarta 10h para 12/08.

### 3. Reforço na Agenda
Ao montar a semana, quando um horário fixo já tiver uma reserva avulsa no mesmo dia/hora/profissional, ocultar o card livre do modelo — evita a vaga fantasma mesmo se faltar a exceção.

## Detalhes técnicos

- `public.fn_agendar_servico`: no `INSERT` em `agenda_servicos`, usar `tipo = 'avulso'` (hoje usa `_tpl.tipo`); quando o template for fixo, inserir também em `agenda_servicos_excecoes (agenda_id = template, data_excecao = p_data)`.
- `public.fn_cancelar_agendamento_servico`: `DELETE` da exceção correspondente (mesmo profissional/horário/data) ao cancelar.
- Correção de dados: `UPDATE agenda_servicos SET tipo='avulso' WHERE id = 0c9358b0-…` + `INSERT` da exceção para o template `942b408c-…` em 2026-08-12.
- `src/pages/Agenda.tsx` (`getEventsForCell`): filtrar cards fixos sem aluno quando existir, no mesmo dia/hora/profissional, um evento com `aluno_id`.
- Sem alteração de schema.
