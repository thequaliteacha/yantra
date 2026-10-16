/* Keeps Yantra opening when the connection drops. Each request tries the network
   first and falls back to the last copy, so updates arrive on the next open.
   Requests to other sites (Spotify) and the recordings pass straight through. */
const CACHE = "yantra-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Recordings stream straight from the network: they are large and arrive in ranges.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/audio/")) return;
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
