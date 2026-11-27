# Corrigir inclusão de alunos na Agenda de Treinos

## Causa confirmada
Ao confirmar a inclusão, a gravação falha com o erro "column dados_novos of relation audit_log does not exist". A função que agenda o aluno grava o registro de auditoria numa coluna que não existe: o registro de auditoria usa `dados_depois`. Por isso nenhum aluno é agendado (a operação inteira é desfeita).

## O que muda
- Uma migration que recria `fn_agendar_treino_equipe` idêntica à atual, trocando apenas `dados_novos` por `dados_depois` no INSERT em `audit_log`.
- Conferir as outras funções da mesma entrega (exclusão de aluno do horário e Treino Experimental de prospect) e corrigir também se usarem a coluna errada.

## Detalhes técnicos
- `audit_log` colunas: id, tabela, registro_id (text), operacao, user_id, dados_antes, dados_depois, created_at. `operacao='insert'` já é aceita pela constraint.
- Teste de regressão em `src/test/agendaTreinosEquipe.test.ts`: as migrations da agenda não podem referenciar `dados_novos` no audit_log.
- Ensaio SQL revertido: incluir um aluno ativo num horário e verificar linha em `treino_agendamentos` e em `audit_log`.
- Rodar `bunx vitest run` e eslint; não precisa de Publish (correção só no banco).
