# Aviso das 20:00 sendo silenciado por notificação antiga

## O que aconteceu hoje

Às 20:00 havia três agendamentos de amanhã (23/09) que deveriam gerar aviso:

| Agendamento | Profissional | Consultor | Enviado às 20:00? |
|---|---|---|---|
| Treino Experimental 09:00 | Vanessa | Nicolas | Não — ambos já tinham recebido hoje às 13:23 |
| Treino Experimental 19:30 | Jonas | Bruno | Não — ambos já tinham recebido hoje às 16:40 |
| Avaliação Funcional 16:30 | Jonas | Bruno | Só o Bruno |

Os dois primeiros casos estão corretos: os avisos automáticos no momento do agendamento ainda estavam ligados quando esses agendamentos foram criados hoje, então a regra "não repetir para quem já recebeu" funcionou como esperado. A partir de agora esses avisos automáticos estão desligados, então esses casos voltam a cair nas 20:00.

O caso da Avaliação Funcional é o problema real: o Jonas recebeu a notificação manual desse mesmo agendamento em **18/09** — cinco dias antes. A regra de não repetir olha o histórico inteiro, sem limite de tempo, então ela cancelou o aviso da véspera para ele. O Bruno nunca tinha recebido nada daquele agendamento, por isso só ele foi avisado.

## O que muda

A regra "não repetir para quem já recebeu" passa a valer apenas para mensagens enviadas **no mesmo dia** do aviso da véspera. Ou seja:

- Se a pessoa clicou em "Notificar via WhatsApp" hoje, o aviso das 20:00 continua sendo suprimido (sem mensagem duplicada).
- Se a notificação manual foi feita dias antes, o aviso das 20:00 é enviado normalmente, como lembrete.

Nada mais muda: horário, textos, destinatários, o botão manual e os avisos de cancelamento seguem iguais.

## Detalhes técnicos

- Arquivo: `supabase/functions/whatsapp-resumo-agenda-amanha/index.ts`.
- Na checagem `ja_recebeu_destinatario` (consulta em `whatsapp_disparos_log` por `agenda_id` + `destinatario_telefone` + `status = 'enviado'`), adicionar filtro `created_at >= <início do dia atual em America/Sao_Paulo, em UTC>`.
- A idempotência por `config_id` + `agenda_id` (`jaEnviado`) permanece sem janela de tempo, evitando reenvio se o cron rodar duas vezes.
- Redeploy da função. Sem migração de banco e sem mudanças de tela.

## Reenvio do aviso perdido

Depois do ajuste, disparar manualmente o aviso da Avaliação Funcional de amanhã para o Jonas (agendamento `fbcd70d4`), já que o aviso das 20:00 não chegou a ele.
