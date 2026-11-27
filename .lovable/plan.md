# Incluir e excluir alunos nos horários da Agenda de Treinos

## O que muda para a equipe
- Ao abrir um horário na Agenda de Treinos, Admin e Coordenador veem o botão **Incluir aluno**.
- O botão abre uma busca por nome (só alunos ativos; equipe, prospects e inativos ficam de fora).
- Ao selecionar o aluno, aparece logo abaixo o **saldo de créditos de treino restantes** no ciclo atual (ou "Livre" para frequência Livre, que não consome créditos; e "Agregadora" para Wellhub/TotalPass).
- Ao confirmar, o aluno entra no horário e o crédito é debitado como num agendamento normal.
- Liberdade total para Admin e Coordenador: podem incluir mesmo com o horário lotado (passa da capacidade, com aviso), mais de um treino no mesmo dia e aluno sem créditos (com aviso de saldo zerado/negativo).
- **Excluir**: o botão de remover aluno do horário, hoje só do Admin, passa a aparecer também para o Coordenador, com duas opções: "Remover e devolver crédito" e "Remover sem devolver crédito".
- Quem agenda sai automaticamente da fila de espera; ao remover, a fila daquele horário é avisada (regras já existentes).
- Professores continuam sem essas opções.

## Detalhes técnicos
- Nova RPC `fn_agendar_treino_equipe(p_slot_id, p_data, p_aluno_id, p_ignorar_capacidade)` SECURITY DEFINER, verifica `has_role` admin ou coordenador, reaproveita o débito de crédito de `fn_agenda_debitar_credito`/lógica de `fn_agendar_treino`, grava `audit_log`; sem grant para anon.
- Nova RPC de leitura `fn_saldo_creditos_treino_aluno(p_aluno_id)` (staff) retornando saldo, total e tipo (créditos/livre/agregadora).
- `fn_staff_excluir_treino_agendamento` já aceita `p_estornar`; ampliar a permissão para coordenador se hoje for só admin.
- Frontend: `src/pages/AgendaTreinos.tsx` (sheet do horário) usa `useUserRoles` com `isAdmin || isCoordenador`; novo componente `IncluirAlunoHorario.tsx` com busca + saldo.
- Testes Vitest das regras (permissão por papel, saldo exibido, Livre sem débito) e ensaio SQL revertido (inclusão debita, remoção com/sem estorno, professor bloqueado, lotado permitido à equipe).
