# Fechar tarefa de reavaliação funcional quando a avaliação é registrada

## O que está acontecendo (confirmado no banco)
- Tania Baldissera Giacobbo tem a tarefa "Agendar reavaliação funcional" aberta (criada em 17/09).
- Gustavo registrou duas avaliações funcionais em 25/09 (mobilidade/flexibilidade e força).
- A rotina que fecha tarefas quando uma avaliação é salva só fecha a tarefa de "avaliação funcional agendada". Ela não fecha a de "reavaliação funcional", por isso a tarefa continuou aparecendo.
- O mesmo acontece com mais alunos: **52 tarefas de reavaliação funcional** seguem abertas mesmo com uma avaliação funcional registrada depois que a tarefa foi criada.

## Correções
1. Ao salvar uma avaliação funcional, fechar também a tarefa "reavaliação funcional" do aluno, além da tarefa de avaliação agendada que ela já fecha.
2. Fechar agora as 52 tarefas de reavaliação que já estão resolvidas, incluindo a da Tania.
3. Não mexer nas outras tarefas da Tania ("Atualizar treino" e "Relatório Técnico — Força"). São tarefas diferentes, que continuam valendo.

## Detalhes técnicos
- Migração: atualizar `fn_concluir_tarefas_por_avaliacao` para usar `tipo_auto IN ('avaliacao_funcional_agendada','reavaliacao_funcional')` quando o tipo contiver "funcional". Manter owner, search_path, SECURITY DEFINER e o gatilho inalterados.
- Ajuste de dados: remover (mesmo comportamento atual do gatilho) as tarefas abertas com `tipo_auto='reavaliacao_funcional'` quando houver uma avaliação funcional com `created_at >= tarefa.created_at`. Antes, listar e conferir as 52.
