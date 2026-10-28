# Pop-up de novas mensagens do WhatsApp

## Como está hoje
Já existe um aviso, mas é a notificação do sistema (Windows/Mac). Ela só aparece se o navegador tiver permissão, não aparece na tela do WhatsApp e mostra "[reaction]" e "[sticker]" em vez do conteúdo.

## O que muda
1. **Pop-up dentro do sistema** (canto inferior direito), em qualquer tela, para admin e coordenador:
   - foto do cadastro ou iniciais, o nome (o do cadastro, se houver) e o começo da mensagem;
   - "Figurinha", "📷 Foto" e "Reagiu 👍 à mensagem" no lugar dos códigos;
   - botão **Abrir**, que leva direto àquela conversa;
   - fica 8 segundos na tela. Várias mensagens da mesma pessoa em sequência atualizam o mesmo pop-up ("3 mensagens novas"), em vez de empilhar.
2. **Na tela do WhatsApp**: o pop-up aparece só para mensagens de outras conversas. A conversa aberta não gera aviso.
3. **Som curto** opcional, com um botão de ligar/desligar no topo da tela do WhatsApp. A escolha fica salva neste navegador.
4. **Aba do navegador**: quando a aba está em segundo plano, continua a notificação do sistema (se houver permissão), agora com o texto certo. O título da aba mostra "(2) Fortem" enquanto houver não lidas.

## Fora do escopo
Nada muda no envio, no recebimento, no Disparo de Mensagens nem nas regras de não lidas.

## Detalhes técnicos
- Reescrever `useWhatsAppNotifications` (já montado no `AppSidebar` para coordenador/admin): ao receber INSERT de `whatsapp_mensagens` com direção recebida, mostra `toast` do sonner com `id = conversa_id`, o que agrupa por conversa. Usa `Notification` só quando `document.hidden`.
- O rótulo vem de uma função pura nova em `src/lib/whatsappChat.ts` (`rotuloPrevia`), que espelha a prévia do webhook. O nome e a foto vêm do mesmo mapa de cadastros por telefone já usado no chat (consulta compartilhada).
- `WhatsAppChat` aceita `?c=<conversa_id>` para abrir a conversa. A conversa aberta fica registrada num estado leve compartilhado, para o hook ignorá-la.
- Som: um beep curto gerado no navegador (Web Audio), sem arquivo; preferência no `localStorage`.
- Título da aba a partir do contador que já existe em `useWhatsAppUnread`.
- Testes Vitest para `rotuloPrevia` e para o agrupamento "N mensagens novas".
