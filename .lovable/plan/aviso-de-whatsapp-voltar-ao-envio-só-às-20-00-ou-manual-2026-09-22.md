# Aviso de WhatsApp: voltar ao envio só às 20:00 (ou manual)

## Situação hoje

Para Treino Experimental e Avaliação Funcional existem três avisos ligados:

- Aviso automático **no momento do agendamento** (professor + cópia para o consultor) — ligado recentemente.
- Aviso automático da **véspera, às 20:00** (professor e consultor).
- Botão **"Notificar via WhatsApp"** na tela de agendamento, que já avisa professor e consultor na hora.

Ou seja, hoje o professor recebe o aviso na hora mesmo sem ninguém clicar no botão.

## O que muda

Desligar apenas o aviso automático no momento do agendamento para essas duas atividades:

- Treino Experimental → Profissional
- Avaliação Funcional → Profissional

Resultado:

- Ao salvar um agendamento, **nada é enviado automaticamente**.
- Se a pessoa clicar em "Notificar via WhatsApp", professor e consultor recebem **na hora** (segue igual).
- Se ninguém clicar, professor e consultor recebem **às 20:00 da véspera**, como antes.

## O que não muda

- Reabilitação, Nutrição e Avaliação Física continuam com o aviso automático no momento do agendamento.
- O aviso de cancelamento continua igual.
- Os avisos por e-mail continuam iguais.
- Nenhuma alteração nas telas nem no texto das mensagens.

## Detalhes técnicos

- Mudança apenas de dados: `ativo = false` nos registros `whatsapp_disparos_config` `23d01386-...` (Treino Experimental → Profissional) e `58964af1-...` (Avaliação Funcional → Profissional), ambos com gatilho `agendamento_criado`.
- `whatsapp-disparo-agenda` continua atendendo o evento `notificacao_manual` (professor + consultor), que não depende dessas configs.
- As configs `resumo_*_amanha` e `resumo_*_amanha_consultor` (20:00) permanecem ativas; elas já evitam repetir o aviso para quem recebeu a notificação manual do mesmo agendamento.
- Nenhum arquivo de código alterado, nenhuma migração de banco.
