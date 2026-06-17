// Service worker para Web Push del admin.

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Polla Mundial 2026", body: event.data.text() };
  }

  const title = data.title || "Polla Mundial 2026";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.svg",
    badge: "/icon.svg",
    vibrate: [100, 50, 100],
    tag: data.tag,
    data: { url: data.url || "/admin" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((lista) => {
        for (const client of lista) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});
