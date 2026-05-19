## Objetivo

Sempre que uma nova notificação for criada (e o usuário atual for destinatário ou criador), abrir uma janela flutuante estilo "chat" no canto inferior direito da tela, em qualquer página do sistema. A janela permite ler/responder em tempo real e desaparece automaticamente quando a notificação for marcada como **concluída** ou **arquivada**.

## Comportamento

- **Quando abrir**: ao receber INSERT em `notificacao_destinatarios` (já existe canal realtime via `useNotificacaoRealtime`) ou ao criar uma notificação como criador. O pop-up aparece automaticamente para todos os participantes online.
- **Quem vê**: criador + destinatários da notificação.
- **Quando fechar (auto)**: quando o `status` da notificação virar `concluida` ou `arquivada`, o pop-up some para todos.
- **Fechamento manual**: usuário pode minimizar (vira uma "pílula" com título + contagem de não lidas) ou fechar (X) — fechar apenas oculta na sessão atual; se houver nova mensagem, reabre minimizado.
- **Múltiplos chats**: até 3 janelas abertas lado a lado no canto inferior direito; demais ficam como pílulas minimizadas empilhadas.
- **Conteúdo do chat**: reaproveita visual de `CommentBubble` (mensagens), input com anexo e Enter para enviar — versão compacta de `NotificacaoDetail`.
- **Marcar como visualizado**: ao abrir/expandir o chat, chama `markVisualizada`.
- **Link "abrir completo"**: botão no header do pop-up leva para `/notificar` com a notificação selecionada.

## Onde renderizar

Componente global `<NotificacaoChatDock />` montado uma vez em `AppLayout` (área autenticada de staff). Não renderiza no Portal do Aluno nem em rotas públicas.

## Arquitetura técnica

**Novos arquivos**
- `src/contexts/NotifChatContext.tsx` — provider com state global: `openChats: string[]`, `minimizedChats: string[]`, `dismissedChats: Set<string>` (sessão). Métodos `openChat(id)`, `minimize(id)`, `dismiss(id)`, `closeAll()`.
- `src/components/notificar/NotificacaoChatDock.tsx` — container fixo `bottom-4 right-4`, renderiza janelas e pílulas.
- `src/components/notificar/NotificacaoChatWindow.tsx` — janela individual ~320×420px (header com título/status/minimizar/fechar/abrir-em-página-cheia, lista de mensagens, input). Reusa `addComentario`, `markVisualizada`, `getAnexoUrl`.

**Mudanças**
- `useNotificacaoRealtime` (hook): além de invalidar queries + toast, chamar `openChat(notif_id)` do contexto quando chega INSERT em `notificacao_destinatarios`. Também escutar UPDATE em `notificacoes` e, se novo `status ∈ {concluida, arquivada}`, chamar `dismiss(id)` para fechar a janela em todos.
- `NewNotificacaoDialog`: após `onSuccess`, chamar `openChat(notifId)` localmente para o criador.
- `AppLayout`: envolver children com `NotifChatProvider` e renderizar `<NotificacaoChatDock />`.
- Subscription extra dentro do Dock/Window para `postgres_changes` em `notificacao_comentarios` filtrado pelo `notificacao_id` ativo → invalidar query do detalhe e tocar um pequeno indicador de "nova mensagem" se janela minimizada.

**Filtragem de status**
- Ao montar o Dock, buscar 1x as notificações ativas do usuário (status diferente de `concluida`/`arquivada`) com participação recente para reidratar janelas que estavam abertas (opcional: persistir `openChats` em `sessionStorage`).
- A query existente `useNotificacoesRecebidas` já traz dados suficientes; filtrar por status para decidir o que mostrar.

## Edge cases

- Página `/notificar` aberta: suprimir o pop-up da notificação atualmente selecionada para não duplicar UI.
- Mobile (<768px): mostrar apenas 1 janela em tela cheia parcial (bottom sheet) — fora do escopo inicial; manter 1 janela compacta full-width no rodapé.
- Notificação sem destinatário do usuário atual: não abrir.

## Sem mudanças de backend

Toda a lógica usa tabelas, RPCs e realtime já existentes. Nenhuma migration necessária.
