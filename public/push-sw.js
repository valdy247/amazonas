self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visibleClient = clientList.find((client) => client.visibilityState === "visible");

      if (visibleClient) {
        visibleClient.postMessage({ type: "push-message", payload });
        return;
      }

      await self.registration.showNotification(payload.title || "Amazona Review", {
        body: payload.body || "You have a new message.",
        icon: "/globe.svg",
        badge: "/globe.svg",
        tag: payload.tag || "amazona-review-message",
        data: {
          url: payload.url || "/dashboard?section=messages",
        },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const targetUrl = event.notification.data?.url || "/dashboard?section=messages";
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
