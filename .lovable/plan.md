## Problema

Login falha com tela "Algo deu errado — Can't find variable: Notification" após autenticar. Os logs de rede confirmam que o `signInWithPassword` retorna 200 e o `user_roles` é carregado — o erro acontece depois, ao montar o `AppSidebar`, dentro do hook `useWhatsAppNotifications`.

## Causa raiz

`src/hooks/useWhatsAppNotifications.ts`, linha 17:

```ts
console.log("[WhatsApp Notification] permissão:", typeof window !== "undefined" ? Notification.permission : "N/A");
```

Essa linha acessa `Notification.permission` **antes** da guarda `if (!("Notification" in window)) return` (linha 20). Em ambientes onde a Web Notifications API não existe (iOS Safari em contexto não-HTTPS, WebViews, alguns navegadores mobile), a referência a `Notification` lança `ReferenceError` e o ErrorBoundary global captura, mostrando "Algo deu errado".

## Correção (1 arquivo)

Em `src/hooks/useWhatsAppNotifications.ts`:

1. Mover a checagem `if (typeof window === "undefined" || !("Notification" in window)) return;` para **antes** de qualquer acesso a `Notification`.
2. Ajustar o `console.log` da permissão para só rodar após a guarda (ou remover — é log de debug).
3. Manter o restante da lógica intacta.

Nada de mudança em backend, auth, ou outros arquivos.

## Risco

Baixo — mudança isolada, só reordena checagens defensivas. Usuários em desktop continuam recebendo notificações normalmente; mobile/webview simplesmente pula o registro do canal (que é o comportamento já pretendido pela guarda existente).
