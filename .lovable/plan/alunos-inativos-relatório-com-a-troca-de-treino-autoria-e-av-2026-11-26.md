# Alunos inativos, relatório com a troca de treino, autoria e avisos aos coordenadores

## O que encontrei no banco
- Hoje há **219 tarefas pendentes** de alunos inativos: 147 de Relatório Técnico de Força, 6 de Relatório de Corrida, 1 de relatório de aula experimental, 60 de reavaliação funcional e 5 de atualização de treino. O caso do Eduardo C. Althaus para o Jonas está entre elas.
- Conto como "inativo" o aluno com situação **inativo** ou que está na etapa **Aluno inativo** do funil.
- Todas as avaliações, relatórios e aulas experimentais já guardam quem fez o registro. O nome só não aparece na tela, então **os registros antigos já ganham o nome do profissional** sem precisar de correção nos dados.

## 1. Aluno inativo para de gerar tarefas
- Quando um aluno passa a ser inativo (pela situação ou pelo funil), o sistema **exclui na hora** as tarefas pendentes dele de Relatório Técnico (força, corrida, reabilitação, experimental), reavaliação/avaliação e atualização de treino. Os avisos ligados a essas tarefas também somem.
- As rotinas que criam tarefas automáticas deixam de criar essas tarefas para alunos inativos.
- Faço uma limpeza única das 219 tarefas pendentes que já existem hoje. Tarefas concluídas continuam no histórico.
- Se o aluno voltar a ficar ativo, as tarefas voltam a ser criadas normalmente pela rotina.

## 2. Relatório Técnico junto com a troca de treino
- Quando o profissional salvar um treino novo para o aluno, abre logo em seguida a tela do Relatório Técnico, já com o aluno preenchido.
- Ao salvar esse relatório, a tarefa pendente de relatório daquele aluno é concluída.
- Deixa de existir uma tarefa de relatório separada da troca de treino: as duas passam a ser uma só, "Atualizar treino + Relatório Técnico".

## 3. Ver quem fez cada registro
- Em Relatórios, Avaliações e Aulas experimentais, na ficha do aluno, cada item mostra **"Registrado por: Nome do profissional"**, na lista e ao abrir o relatório.
- Isso vale para os registros antigos (o dado já existe) e para os novos (o profissional que salva fica gravado sempre, sem poder ser trocado).

## 4. Avisos para coordenadores e administradores
- Quando um professor, nutricionista ou fisioterapeuta registrar uma aula experimental, avaliação ou relatório, todos os coordenadores e administradores recebem um aviso na central de notificações do sistema: "Jonas registrou Relatório Técnico de Eduardo C. Althaus", com link para a ficha.
- Se quem registrou for coordenador ou administrador, não recebe aviso do próprio registro.

## Detalhes técnicos
- Migration: gatilho em `alunos` (mudança de `status` para inativo ou de `current_pipeline_stage_id` para uma etapa do funil `inativo`) que apaga `tarefas` pendentes com `tipo_auto` em (relatorio_tecnico_forca, relatorio_tecnico_corrida, relatorio_reabilitacao, relatorio_experimental, reavaliacao_funcional, avaliacao_funcional_agendada, atualizar_treino); helper `fn_aluno_inativo(aluno_id)` aplicado nas funções que geram essas tarefas; limpeza única das pendentes atuais.
- Unificação: a geração de `relatorio_tecnico_forca` passa a acontecer com `atualizar_treino`; ao salvar um treino, o fluxo abre o relatório; ao salvar o relatório, a tarefa é concluída.
- `avaliacoes.avaliador_id` aparece nas telas com o nome vindo de `profiles`; um gatilho força `avaliador_id = auth.uid()` quando ele chega vazio e impede a troca dele numa edição.
- Gatilho AFTER INSERT em `avaliacoes` cria `notificacoes` + `notificacao_destinatarios` para quem tem papel admin ou coordenador (SECURITY DEFINER, sem permissão para visitantes).
- Testes de regressão: a tarefa some quando o aluno fica inativo, nenhuma tarefa é criada para aluno inativo, o autor aparece, o aviso vai só para coordenadores e administradores. Depois rodo vitest e eslint. Regras registradas no AGENTS.md da área.
