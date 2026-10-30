/* Keeps a sit available after the network is gone.
   The shell is saved on install and refreshed when the network answers.
   Self-hosted albums are stored whole, in their own cache, only when someone
   chooses Keep offline. A partial response is never kept. Spotify, talks,
   quotes, and ambient audio stay on the network. */
const YantraSW = (function () {
  const SHELL = "yantra-v7";
  const AUDIO = "yantra-audio-v1";
  const SHELL_FILES = [
    "/web/",
    "/web/index.html",
    "/index.html",
    "/discs.json",
    "/access",
    "/web/manifest.webmanifest",
    "/web/config.json",
    "/web/audio.json",
    "/web/sets.json",
    "/web/tracks.json",
    "/web/offline.js",
    "/web/offer.js",
    "/web/practice.js",
    "/web/listening.js",
    "/web/qrcode.js",
    "/web/browser.js",
    "/web/sync.js",
    "/web/playback.js",
    "/web/choose.js",
    "/web/quotes.js",
    "/web/talks.js",
    "/web/talkview.js",
    "/web/altar.js",
    "/web/settings.js",
    "/web/profile.js",
    "/web/saved-talks.js",
    "/web/resources.js",
    "/web/account.js",
    "/web/sit.js",
    "/web/web.js",
    "/web/reminders.js",
    "/web/places.js",
    "/web/schedule.js",
    "/web/solar.js",
    "/web/series.js",
    "/web/field.js",
    "/web/awakening.js",
    "/web/icons/icon.svg",
    "/web/icons/apple-touch-icon.png",
    "/web/icons/icon-192.png",
    "/web/icons/icon-512.png",
  ];

  function routeKind(url, method) {
    if ((method || "GET") !== "GET") return "skip";
    if (url.pathname === "/web/sw.js") return "skip";
    if (url.pathname.includes("/audio/") && /\.mp3$/i.test(url.pathname)) return "audio";
    if (url.pathname.startsWith("/push") || url.pathname.startsWith("/api/") || url.pathname === "/logout") return "skip";
    if (url.pathname.endsWith("/quotes.json") || url.pathname.endsWith("/talks.json") || url.pathname.startsWith("/talks") || url.pathname.startsWith("/ambient")) return "skip";
    return "shell";
  }

  /* One range, drawn from a complete body. Suffix and open ends are fine.
     Anything else is not a range we will invent. */
  function parseByteRange(header, size) {
    const sizeN = Number(size) || 0;
    if (!header || sizeN <= 0) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
    if (!match || (match[1] === "" && match[2] === "")) return null;
    let start;
    let end;
    if (match[1] === "") {
      const suffix = Number(match[2]);
      if (!suffix) return { status: 416, size: sizeN };
      start = Math.max(0, sizeN - suffix);
      end = sizeN - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? sizeN - 1 : Number(match[2]);
      if (end >= sizeN) end = sizeN - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= sizeN || start > end) {
      return { status: 416, size: sizeN };
    }
    return { status: 206, start: start, end: end, size: sizeN };
  }

  function sliceBody(bytes, header) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const size = view.byteLength;
    if (!header) return { status: 200, start: 0, end: Math.max(0, size - 1), size: size, body: view };
    const range = parseByteRange(header, size);
    if (!range || range.status === 416) {
      return { status: 416, size: size, start: 0, end: 0, body: new Uint8Array() };
    }
    return {
      status: 206,
      start: range.start,
      end: range.end,
      size: size,
      body: view.slice(range.start, range.end + 1),
    };
  }

  return {
    SHELL: SHELL,
    AUDIO: AUDIO,
    SHELL_FILES: SHELL_FILES,
    routeKind: routeKind,
    parseByteRange: parseByteRange,
    sliceBody: sliceBody,
    retainCache: function (name) { return name === SHELL || name === AUDIO; },
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = YantraSW;

if (typeof ServiceWorkerGlobalScope !== "undefined" && self instanceof ServiceWorkerGlobalScope) {
  async function remember(cache, request, response) {
    const type = response.headers.get("content-type") || "application/octet-stream";
    const body = await response.clone().blob();
    const stored = new Response(body, { status: 200, headers: { "content-type": type } });
    await cache.put(request, stored);
  }

  self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(YantraSW.SHELL);
      await Promise.all(YantraSW.SHELL_FILES.map(async (path) => {
        try {
          const url = new URL(path, self.location.origin).href;
          const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
          if (response && response.ok) await remember(cache, url, response);
        } catch (e) {}
      }));
      await self.skipWaiting();
    })());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !YantraSW.retainCache(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })());
  });

  async function networkFirst(request) {
    const cache = await caches.open(YantraSW.SHELL);
    try {
      const response = await fetch(request);
      if (response && response.ok) await remember(cache, request, response);
      return response;
    } catch (e) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await caches.match(new URL("/web/index.html", self.location.origin).href)
          || await caches.match(new URL("/web/", self.location.origin).href);
        if (shell) return shell;
      }
      return new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  }

  async function audioRequest(request) {
    const url = new URL(request.url);
    url.search = "";
    try {
      const cache = await caches.open(YantraSW.AUDIO);
      const cached = await cache.match(url.href);
      const size = cached ? Number(cached.headers.get("content-length")) : 0;
      if (cached && cached.status === 200 && (!cached.headers.has("content-length") || size > 0)) {
        const range = request.headers.get("range");
        if (!range) return cached;
        const bytes = new Uint8Array(await cached.arrayBuffer());
        const piece = YantraSW.sliceBody(bytes, range);
        const headers = {
          "content-type": cached.headers.get("content-type") || "audio/mpeg",
          "content-length": String(piece.body.byteLength),
          "accept-ranges": "bytes",
        };
        if (piece.status === 206) headers["content-range"] = "bytes " + piece.start + "-" + piece.end + "/" + piece.size;
        if (piece.status === 416) headers["content-range"] = "bytes */" + piece.size;
        return new Response(piece.body, { status: piece.status, headers: headers });
      }
    } catch (e) {}
    return fetch(request);
  }

  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    const kind = YantraSW.routeKind(url, request.method);
    if (kind === "skip") return;
    if (kind === "audio") {
      event.respondWith(audioRequest(request));
      return;
    }
    event.respondWith(networkFirst(request));
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
}
