# Aviso de WhatsApp para agendamentos feitos no mesmo dia

## O que aconteceu com a Pâmela

O treino experimental foi criado hoje às 12:17 (horário de SP) para hoje às 19:30. Verificando os registros:

- O único WhatsApp enviado foi o manual, ao clicar em "Notificar profissional": foi para o Gustavo (professor). O consultor não recebeu nada, porque a notificação manual sempre envia só para o professor.
- O aviso automático de novo agendamento de Treino Experimental está **desligado** na configuração de disparos (a regra "Treino Experimental → Profissional" está inativa). Só estão ativas as regras de Reabilitação/Nutrição/Avaliação Física.
- Não existe nenhuma regra de novo agendamento para **consultor** — hoje o consultor só é avisado pelo resumo da véspera.
- Os avisos completos (com dados do aluno, objetivo, limitações etc.) para professor e consultor rodam às 23:00 do dia anterior. Como o agendamento foi criado hoje para hoje, essa janela já tinha passado e nunca vai acontecer.

Ou seja: agendamentos criados para o próprio dia hoje ficam sem aviso automático.

## O que vou fazer

1. Ligar o aviso automático de novo agendamento para o **professor** em Treino Experimental e Avaliação Funcional, usando a mesma mensagem completa já aprovada (aluno, data/hora, local, objetivo, limitações, observações).
2. Criar as regras equivalentes para o **consultor** no momento do agendamento, com a mesma mensagem.
3. Permitir que o disparo de agendamento envie para consultor (hoje só sabe enviar para professor ou aluno).
4. Fazer a notificação manual ("Notificar profissional") avisar também o consultor, passando a se chamar "Notificar professor e consultor".
5. Evitar mensagem repetida: quem já recebeu o aviso na criação não recebe de novo no resumo da véspera (a trava por agendamento já existe, vou estendê-la para cobrir os dois momentos).
6. Reenviar manualmente o aviso do agendamento da Pâmela para o consultor, para que ele tenha as informações ainda hoje.

## Detalhes técnicos

- `whatsapp-disparo-agenda`: resolver destinatário `consultor` (perfil via `agenda_servicos.consultor_id` → `profiles.phone`), reaproveitando `buscarPerfil` do padrão já usado em `whatsapp-resumo-agenda-amanha`; no `notificacao_manual`, enviar para professor e consultor com log separado por destinatário.
- Migração de dados em `whatsapp_disparos_config`: ativar `23d01386` (Treino Experimental → Profissional) e `58964af1` (Avaliação Funcional → Profissional); inserir duas linhas `gatilho = 'agendamento_criado'`, `destinatario = 'consultor'`, `modo_teste = false`, com `atividades` respectivas e o mesmo `template_texto` dos resumos.
- Idempotência: `whatsapp_disparos_log` por (`agenda_id`, destinatário) — no resumo da véspera, pular quando já houver envio `enviado` para o mesmo agendamento e mesmo telefone.
- `AddAgendaDialog.tsx`: apenas rótulo do botão e toast; a chamada de `whatsapp-disparo-agenda` permanece igual.
- Sem mudanças de RLS; tudo roda com service role nas funções.
