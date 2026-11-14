self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      title: "Simplicity ERP",
      body: event.data ? event.data.text() : "Naya update aaya hai!"
    };
  }

  const title = data.title || "Simplicity ERP";
  const options = {
    body: data.body || "Portal kholkar check karein.",
    icon: "/testing-dev/icon-192.png",
    badge: "/testing-dev/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || self.registration.scope || "./" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : (self.registration.scope || "./");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
