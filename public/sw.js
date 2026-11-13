// Service worker para Web Push del panel.

// Es un archivo estático: no puede importar `MARCA` de src/lib/marca.ts.
const MARCA = "Play Mundial";

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }

  // Un aviso de torneo lleva su nombre arriba; lo que pasó queda en el cuerpo.
  const title = data.torneo ? `🏆 ${data.torneo}` : data.title || MARCA;
  const body = data.torneo
    ? [data.title, data.body].filter(Boolean).join("\n")
    : data.body || "";

  const options = {
    body,
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    tag: data.tag,
    // Los avisos de un partido (en vivo, fin de set, por aprobar) comparten etiqueta para no
    // apilarse. Sin `renotify`, el nuevo reemplaza al anterior EN SILENCIO y el aviso pasa inadvertido.
    renotify: !!data.tag,
    data: { url: data.url || "/admin" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    (async () => {
      // En iPhone la app instalada puede abrirse sin respetar el enlace: se guarda a
      // dónde iba y la propia app navega ahí al abrirse (aviso-navegacion.tsx).
      try {
        const cache = await caches.open("nav-aviso");
        await cache.put("/__nav", new Response(JSON.stringify({ url, ts: Date.now() })));
      } catch {
        /* sin caché: se sigue con la navegación normal */
      }
    })().then(() =>
      clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (lista) => {
        for (const client of lista) {
          if ("focus" in client) {
            try {
              // Falla en ventanas que este service worker aún no controla.
              await client.navigate(url);
              return client.focus();
            } catch {
              break;
            }
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
    ),
  );
});
