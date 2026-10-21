/* Keeps Yantra opening when the connection drops. Each request tries the network
   first and falls back to the last copy, so updates arrive on the next open.
   Requests to other sites (Spotify) and the recordings pass straight through. */
const CACHE = "yantra-v5";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Recordings stream straight from the network: they are large and arrive in ranges.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/audio/") || url.pathname.startsWith("/push") || url.pathname === "/logout") return;
  if (url.pathname === "/access" || url.pathname.endsWith("/quotes.json") || url.pathname.endsWith("/talks.json") || url.pathname.startsWith("/talks")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const evening = data.theme === "evening";
  const title = data.title || (evening ? "Evening" : "Morning");
  const body = data.body || "A few minutes of stillness?";
  const ready = evening ? "evening" : "morning";
  const url = typeof data.url === "string" && data.url.startsWith("/web/") ? data.url : "/web/?ready=" + ready;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "icons/apple-touch-icon.png",
    data: { url, ready },
    tag: "yantra-" + ready,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ready = event.notification.data && event.notification.data.ready === "evening" ? "evening" : "morning";
  const url = (event.notification.data && event.notification.data.url) || "/web/?ready=" + ready;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of open) {
      const path = new URL(client.url).pathname;
      if (path === "/web" || path.startsWith("/web/")) {
        await client.focus();
        client.postMessage({ ready });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
