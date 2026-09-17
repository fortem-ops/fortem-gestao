# Tarefas: primeiro contato e Relatório Técnico

## 1. Retirar "Realizar primeiro contato"

Hoje existem 62 tarefas abertas "Realizar primeiro contato", criadas automaticamente sempre que um lead entra no pipeline.

- Parar a criação automática dessa tarefa quando um novo lead é registrado.
- Apagar as 62 tarefas abertas que já existem.
- As demais tarefas do pipeline (confirmar presença na avaliação, follow-ups, encerrar atendimento, confirmar pagamento) continuam como estão.

## 2. Relatório Técnico não fica com administradores

Hoje 10 tarefas de Relatório Técnico estão com administradores, porque eles constam como responsáveis por alguns alunos.

- Essas 10 tarefas passam para o coordenador.
- Daqui para frente, quando o responsável pelo aluno for um administrador, a tarefa de Relatório Técnico já nasce com o coordenador.
- Havendo mais de um coordenador, é usado o coordenador mais antigo; se não houver nenhum, o comportamento atual é mantido.

## Detalhes técnicos

- Migration:
  - `fn_move_pipeline()`: remover o bloco que insere a tarefa `tipo_auto = 'pipeline_novo_lead'` ("Realizar primeiro contato"), preservando o restante da função (atribuição de tarefas comerciais ao admin, movimentações e demais inserções).
  - Nova função `fn_coordenador_tarefas()` (SECURITY DEFINER, STABLE): retorna o `user_id` do coordenador mais antigo por `user_roles.created_at`.
  - `fn_gerar_tarefas_relatorio_tecnico()`: no cálculo de `responsavel_id` de força e corrida, se o responsável resolvido tiver papel `admin`, substituir por `fn_coordenador_tarefas()` quando existir.
- Dados (via ferramenta de consulta, não migration):
  - `DELETE FROM tarefas WHERE tipo_auto = 'pipeline_novo_lead' AND status <> 'concluida'`.
  - `UPDATE tarefas SET responsavel_id = <coordenador mais antigo> WHERE tipo_auto LIKE 'relatorio_tecnico%' AND status <> 'concluida' AND responsavel_id IN (admins)`.
- Verificação: conferir contagens no banco, typecheck, suíte de testes e build.
