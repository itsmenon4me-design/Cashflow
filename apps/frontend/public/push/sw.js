self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      console.error("Unable to parse Web Push payload", error);
    }
  }

  const title =
    typeof payload.title === "string" ? payload.title : "CashFlow";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "Ada notifikasi baru. Buka CashFlow untuk melihat detail.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL("/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          return existing.navigate(targetUrl).then((client) => client?.focus());
        }
        return self.clients.openWindow(targetUrl);
      },
    ),
  );
});
