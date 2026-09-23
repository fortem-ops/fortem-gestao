# Lista de Presença: só agendamentos com aluno e presença automática às 21:00

## O que muda para você

1. **Só aparecem horários com aluno/paciente agendado**
   Horários sem ninguém marcado (hoje são 47 de 243) somem da Lista de Presença, nas visões Dia, Semana e Mês. Os totais (Total, Marcadas, Presentes, Faltas) passam a contar só esses horários. A Agenda continua mostrando todos os horários, como hoje.

2. **Presença automática às 21:00 (horário de Brasília), todos os dias**
   - Todo agendamento do dia que tenha aluno e ainda não tenha presença ou falta marcada recebe "Presente" automaticamente.
   - O que já foi marcado à mão (presente ou falta) não é tocado.
   - Horários retirados da agenda naquele dia (exceções) não recebem presença.
   - Depois das 21:00 a marcação continua podendo ser corrigida à mão: dá para trocar para "Falta" ou desfazer.
   - As presenças automáticas ficam identificáveis ("Presença automática 21:00"), sem profissional como autor.

## Ponto de atenção (sua decisão)

Hoje, quando um **treino experimental** recebe presença, o sistema move a pessoa automaticamente no funil (de lead para prospect). Com a presença automática, quem faltou a um experimental e não teve a falta marcada também seria movido. Proposta: **a presença automática não vale para agendamentos de treino experimental**; esses continuam só com marcação manual. Se preferir incluir, é só dizer.

## Detalhes técnicos

- `src/pages/Presencas.tsx`: incluir `.not("aluno_id", "is", null)` na busca de `agenda_servicos`. Isso afeta as três visões e os totais de uma vez. Nenhuma outra tela muda.
- Migração: função `fn_presencas_auto_21h()` (SECURITY DEFINER, `search_path=public`, execução só de `service_role`). Ela insere em `agenda_presencas` (`comparecimento=true`, `marcado_por=null`, `observacao='Presença automática 21:00'`) para a data de hoje em America/Sao_Paulo:
  - fixos com `dia_semana` do dia e sem linha em `agenda_servicos_excecoes`, mais avulsos com `data_especifica` = hoje;
  - `aluno_id` não nulo; experimentais excluídos (conforme a decisão acima);
  - `ON CONFLICT (agenda_id, data) DO NOTHING`, para nunca sobrescrever uma marcação manual.
- Agendamento: novo job `presencas-auto-21h` com `0 0 * * *` (00:00 UTC = 21:00 em Brasília; o Brasil não tem horário de verão). Sem mexer em nenhum outro job, nem no job 28, que segue desligado.
- Créditos, cobranças e agendamentos não são alterados. A presença não desconta crédito; o desconto já acontece no agendamento.
- Verificação: teste da função com a transação desfeita (contagem do que seria inserido hoje) e conferência de que as marcações manuais continuam intactas.
