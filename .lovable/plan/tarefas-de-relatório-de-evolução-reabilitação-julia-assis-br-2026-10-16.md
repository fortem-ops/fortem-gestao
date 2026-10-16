# Tarefas de Relatório de Evolução (Reabilitação) — Julia Assis Brasil

## O que foi confirmado (últimos 30 dias, 24 agendamentos de Reabilitação da Julia)

- 6 agendamentos têm a tarefa aberta hoje. 18 não têm.
- **2 agendamentos nunca geram tarefa:** foram marcados sem paciente cadastrado (09/10 16:30 e 28/09 18:30). A regra exige um paciente.
- **Nos outros 16:** a tarefa foi criada e depois apagada. O sistema conclui uma tarefa apagando-a, e não guarda registro disso. Por isso não dá para provar caso a caso quando cada uma sumiu. Todos esses pacientes têm sessões finalizadas depois do agendamento.
- **Falha confirmada na regra de conclusão.** Quando a Julia finaliza uma sessão, o sistema apaga a tarefa mais antiga do paciente. Se não houver nenhuma vencida, apaga a próxima, mesmo que seja de um atendimento futuro. Assim, finalizar uma sessão pode fazer sumir a tarefa de outro dia.
- Exemplo real: ADEMAR teve dezenas de sessões finalizadas de uma só vez em 14/10. Isso pode ter apagado em sequência as tarefas de 02/10 e 07/10.
- **Outro ponto fraco:** se a data de um agendamento muda depois de criado, a tarefa continua na data antiga.

## Correção proposta

1. Concluir só a tarefa do mesmo dia da sessão finalizada. Se não houver, concluir uma tarefa vencida. Nunca concluir tarefa de atendimento futuro.
2. Ao finalizar várias sessões de uma vez, concluir no máximo uma tarefa por sessão, cada uma pela sua data.
3. Quando a data ou o horário de um agendamento mudar, mover a tarefa junto.
4. Registrar cada tarefa concluída automaticamente (qual, quando, por qual sessão), para poder conferir casos como este.
5. Agendamento de Reabilitação sem paciente: mostrar um aviso na Agenda dizendo que a tarefa só é criada com paciente vinculado.
6. Recriar as tarefas que faltam para agendamentos passados da Julia que não têm sessão finalizada no mesmo dia (lista revisada antes de aplicar).

## Detalhes técnicos

- `fn_concluir_tarefas_por_reabilitacao`: comparar os `finalizado_em` novos com os antigos, pegar a data (America/Sao_Paulo) de cada sessão nova e apagar a tarefa `relatorio_reabilitacao` aberta com `data_limite` igual; se não houver, a mais antiga com `data_limite <= data da sessão`; nunca uma com `data_limite > CURRENT_DATE`.
- Novo trigger `AFTER UPDATE OF data_especifica, horario_fim ON agenda_servicos`: atualiza `data_limite`/`hora_limite` da tarefa aberta correspondente.
- Log em `system_logs` dentro do trigger de conclusão.
- Aviso no formulário da Agenda quando a atividade é Reabilitação e não há paciente.
- Backfill por consulta com prévia da lista antes de inserir.
- Não mexe em Planos 1 e 2, flags, contratos nem cobranças.
