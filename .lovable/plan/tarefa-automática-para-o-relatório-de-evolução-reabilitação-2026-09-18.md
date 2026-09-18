# Tarefa automática para o Relatório de Evolução (Reabilitação)

## O que muda

Ao agendar uma **Reabilitação** na Agenda, o profissional responsável passa a receber automaticamente uma tarefa "Realizar relatório de evolução — Reabilitação" na Central de Tarefas.

- Até o horário do atendimento, a tarefa aparece em **Programadas** (contador verde).
- Passado o horário de término do agendamento, ela passa para **Atrasadas** (contador vermelho).
- A tarefa fica na subaba **Relatórios**.
- O botão **Realizar** abre direto o formulário de Evolução do aluno agendado, já com o tipo Reabilitação e o protocolo Evolução selecionados.
- Quando o profissional registra uma **Nova Sessão** e a finaliza, a tarefa some sozinha (concluída).
- Se o agendamento de Reabilitação for excluído, a tarefa aberta correspondente também é removida.

Nada muda nas demais tarefas (avaliação funcional, experimental, treinos, ponto, relatórios técnicos), nem nas telas de Avaliação, Agenda e Relatórios fora desse fluxo.

## Detalhes técnicos

### Banco (migrations aditivas, sem apagar dados)

1. `ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS hora_limite time` (nullable) — permite atraso no mesmo dia, depois do horário do agendamento.
2. `fn_tarefa_reabilitacao_agendada()` + trigger `AFTER INSERT ON agenda_servicos`:
   - só para `atividade ILIKE '%reabilita%'` e `aluno_id NOT NULL`;
   - responsável = `COALESCE(profissional_id, alunos.responsavel_id)`;
   - `data_limite = COALESCE(data_especifica, CURRENT_DATE)`, `hora_limite = horario_fim`;
   - `tipo_auto = 'relatorio_reabilitacao'`, `automatica = true`, status `pendente`;
   - deduplicação por aluno + `tipo_auto` + `data_limite` (mesmo padrão da avaliação funcional agendada).
3. `fn_tarefa_agenda_removida()` ganha o ramo de reabilitação: apaga tarefas abertas `relatorio_reabilitacao` do aluno com `data_limite = OLD.data_especifica`.
4. `fn_concluir_tarefas_por_reabilitacao()` + trigger `AFTER INSERT OR UPDATE OF dados ON avaliacoes`:
   - dispara quando `tipo` contém `reabilita` e o número de sessões com `finalizado_em` não nulo em `dados->'sessoes'` aumentou em relação a OLD (no INSERT, ≥ 1);
   - apaga (conclusão = DELETE, conforme regra atual) a tarefa aberta `relatorio_reabilitacao` do aluno com a `data_limite` mais antiga ≤ hoje; se não houver vencida, a próxima aberta.

### Frontend

- `src/pages/TaskCenter.tsx`: `atrasada` passa a considerar `hora_limite` — atrasada se `data_limite < hoje` ou (`data_limite = hoje` e `hora_limite` já passou, hora de São Paulo). `grupoDaTarefa()` mapeia `relatorio_reabilitacao` → grupo **Relatórios**. Campo `hora_limite` incluído no select.
- `src/lib/taskAction.ts`: `relatorio_reabilitacao` → `/avaliacoes?aluno=<id>&new=1&tipo=reabilitacao&protocolo=evolucao`.
- `src/pages/Avaliacoes.tsx`: lê `tipo` e `protocolo` da URL e repassa como prefill ao `AssessmentForm`.
- `src/components/student/assessment/AssessmentForm.tsx`: props opcionais `tipoSlugInicial` / `protocoloNomeInicial`; quando informados, pré-seleciona o tipo pelo slug e o protocolo (para `evolucao`, usa `isProtocoloEvolucao`). Sem prefill, comportamento atual inalterado.
- `src/hooks/useTarefasBadge.ts`: mesma regra de `hora_limite` para o contador da barra lateral.

### Validação

Typecheck, build e suíte de testes; conferência no preview de uma tarefa de reabilitação criada a partir de um agendamento e do botão Realizar abrindo a Evolução.

## Ponto em aberto

Agendamentos fixos recorrentes (sem data específica) geram a tarefa apenas para o dia da criação. Se a Reabilitação também for usada em horário fixo semanal, posso adicionar uma rotina diária que cria a tarefa a cada ocorrência — diga se isso é necessário.
