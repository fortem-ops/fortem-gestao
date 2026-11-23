# Avisos de treino experimental: o que aconteceu e o que corrigir

## O que o banco mostra (hoje, 23/11)
As mensagens **foram enviadas e entregues**. Hoje de manhã houve três envios manuais de "Treino Experimental":

| Hora (Brasília) | Professor | Consultor | Retorno do WhatsApp |
|---|---|---|---|
| 09:27 | Cristiano Ransolin | Bruno Silva Funari | entregue aos dois |
| 09:28 | Cristiano Ransolin | Bruno Silva Funari | entregue aos dois; Cristiano **leu** |
| 09:29 | Thaís dos Santos | Bruno Silva Funari | entregue aos dois |

Não houve nenhum erro.

## Por que parece que não foram
Esses avisos saem por modelo aprovado pela Meta. O sistema só grava na tela WhatsApp (as conversas) as mensagens de texto livre. As mensagens por modelo chegam ao celular, mas **não aparecem na conversa do profissional na tela WhatsApp**. Por isso dá a impressão de que nada saiu.

## O que proponho mudar
1. Todo envio por modelo (aviso de agenda, aviso de amanhã etc.) passa a aparecer na conversa do destinatário na tela WhatsApp, com o texto do aviso e a marcação "enviado / entregue / lido".
2. Depois de clicar em "Notificar professor e consultor", a mensagem de confirmação diz para quem foi: "Enviado para Cristiano e Bruno". Se o consultor não tiver telefone, ela avisa.
3. Teste de regressão: um envio por modelo precisa gerar a mensagem na conversa.

Não muda nada em quem recebe, nos modelos, nem na rotina da agenda de amanhã.

## Para testar
Agendar um treino experimental, clicar em notificar e abrir a tela WhatsApp: a mensagem precisa aparecer na conversa do professor e do consultor.

## Detalhes técnicos
- `send-whatsapp`: no modo modelo, chamar `upsertConversaAndSave` com o `wamid` e o `wa_id` retornados e um texto montado a partir dos parâmetros (ou um resumo recebido do chamador, campo opcional `resumo`).
- `whatsapp-disparo-agenda`: passar `resumo` nos envios por modelo; resposta inclui os nomes dos destinatários.
- `AddAgendaDialog.tsx`: toast com nomes e aviso de consultor sem telefone.
- Sem migração. Desfazer: reverter o commit e publicar as duas funções de novo.
