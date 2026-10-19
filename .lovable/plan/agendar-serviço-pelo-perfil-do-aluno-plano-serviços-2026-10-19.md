# Agendar serviço pelo perfil do aluno (Plano/Serviços)

## O que muda para a equipe
- Na aba **Plano/Serviços** do aluno, botão **Agendar serviço** (só para quem já vê essa aba: coordenação/admin).
- Abre uma janela: escolher o serviço (Avaliação Funcional, Nutrição, Reabilitação etc., só os que o aluno tem crédito), depois a data, e aparecem os **horários livres** da Agenda de Serviços (mesmas vagas que o aluno vê no app).
- Mostra o saldo de créditos do serviço antes de confirmar. Ao confirmar, o horário fica ocupado com o aluno e **1 crédito é debitado** na hora.
- Sem crédito, horário passado ou vaga já ocupada: mensagem clara e nada é gravado.
- Lista "Próximos agendamentos" do aluno atualiza na hora.

## O que continua igual
- O agendamento é o mesmo que o aluno faz pelo app: o profissional recebe a mensagem de WhatsApp, a tarefa (ex.: Relatório de evolução) é criada, e cancelamento/estorno de crédito seguem as regras atuais.
- Agenda de Serviços, portal do aluno, Planos 1 e 2, flags, contratos e cobranças não mudam.

## Detalhes técnicos
- Hoje `fn_agendar_servico(p_agenda_servico_id, p_data)` identifica o aluno por `fn_current_aluno_id()` (sessão do aluno). Nova função `fn_agendar_servico_equipe(p_aluno_id, p_agenda_servico_id, p_data)`, SECURITY DEFINER, exige coordenador/admin, e reaproveita a mesma lógica (refatorar o corpo para uma função interna comum chamada pelas duas, sem alterar o comportamento da versão do aluno). Isso garante mesma checagem de vaga, débito de crédito e os mesmos triggers de WhatsApp/tarefa (disparados pela inserção em `agenda_servicos`).
- Origem registrada como "equipe" + quem agendou em `system_logs`.
- Front: `AgendarServicoDialog` em `src/components/student/`, reaproveitando as consultas de horários/créditos do `PortalAgenda` (extrair para um hook compartilhado); botão em `StudentPlan.tsx`.
- Teste: sem crédito não agenda; vaga ocupada recusada; débito de 1 crédito.
- Verificação: conferir um agendamento de teste com NICOLAS TESTE e depois cancelar (estornando o crédito).
