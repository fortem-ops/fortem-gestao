// FORTEM SW v2 (troca da raiz, out/2026): apenas Web Push. Sem fetch/cache: nunca serve páginas antigas.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'FORTEM', body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || (data.app === 'equipe' ? '/' : '/portal'), app: data.app || 'aluno' },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' },
    ],
    requireInteraction: false,
    tag: data.gatilho || 'fortem-notification',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'FORTEM', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  const app = event.notification.data?.app || 'aluno';
  const url = event.notification.data?.url || (app === 'equipe' ? '/' : '/portal');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const ehPortal = new URL(client.url).pathname.startsWith('/portal');
        if ((app === 'equipe' ? !ehPortal : ehPortal) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });
