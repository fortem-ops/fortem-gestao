# Aba "Frequência" no perfil do aluno

Nova aba entre **Treinos** e **Avaliações** no perfil do aluno, mostrando a frequência real do aluno cruzando a agenda de treinos com o que ele registra no portal.

## O que a aba mostra

Uma linha por data agendada (mais recente primeiro), com:

- Data e horário do agendamento
- Situação da agenda: Agendado / Confirmado / Realizado / Cancelado
- Treino proposto para aquela data (ex.: T3 da Fase 1) — a variação que estava prevista na rotação
- Treino realizado (ex.: T4), quando o aluno registrou a conclusão no portal
- Selo "Trocado" quando o aluno concluiu uma variação diferente da proposta (o caso da Bruna Meyer em 12/08: proposto T3, realizado T4)
- Nome do programa/fase do treino executado

Acima da lista, um resumo do período: total de agendamentos, realizados, cancelados, taxa de comparecimento e nº de trocas.

Filtros: período (últimos 30/90 dias, ano, tudo) e situação.

Se o aluno não tem agendamentos, a aba mostra estado vazio explicando que a frequência é gerada pela agenda de treinos.

## Como o "proposto" é definido

- Se existe sessão registrada com troca, o proposto é a variação original guardada no registro e o realizado é a variação efetiva.
- Se existe sessão sem troca, proposto = realizado.
- Se a data está agendada e ainda não houve registro, o proposto é calculado pela rotação (T1→T2→T3→T4) a partir das sessões já concluídas em ordem de data, igual à lógica que o portal usa.

## Somente leitura

A aba é de consulta. Ajustes de datas continuam sendo feitos pelo aluno no portal e pela equipe na Agenda de Treinos.

## Detalhes técnicos

- Novo componente `src/components/student/StudentFrequencia.tsx`.
- Registro da aba em `src/pages/StudentProfile.tsx` (`TabsTrigger`/`TabsContent` valor `frequencia`, após `treinos`).
- Dados: `treino_agendamentos` (data, horários, status) com `left join` lógico em `treino_sessoes` por `agendamento_id`, e `treinos` para descrição/fase. Consultas via TanStack Query com `queryKey` `["student-frequencia", aluno_id, filtros]`.
- Sessões sem `agendamento_id` (registradas fora da agenda) entram na lista como linhas "sem agendamento" na data da sessão, para não sumirem do histórico.
- RLS já permite leitura pela equipe nas três tabelas (`is_staff()`); nenhuma migração de banco é necessária.
- Sem alteração em portal, agenda ou lógica de conclusão de treino.
