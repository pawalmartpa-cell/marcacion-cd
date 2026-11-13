/* Al tocar una notificación del sistema, abre la app en la pantalla correspondiente. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate(url).catch(() => {});
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

/* Notificación push (FCM) con la app cerrada: el Worker envía { titulo, cuerpo, url, tag }. */
self.addEventListener('push', (event) => {
  let m = {};
  try {
    m = event.data ? event.data.json() : {};
  } catch {
    m = {};
  }
  const d = m.data || m;
  if (!d || !d.cuerpo) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      // Si la app está abierta y a la vista, ya muestra el aviso adentro: no se duplica.
      if (ventanas.some((v) => v.visibilityState === 'visible' && v.focused)) return;
      return self.registration.showNotification(d.titulo || 'Marcación CD', {
        body: d.cuerpo,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: d.tag || undefined,
        renotify: !!d.tag,
        vibrate: [120, 60, 120],
        data: { url: d.url || '/' },
      });
    }),
  );
});
