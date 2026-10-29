/* Albums kept on this device for a sit without a network.
   The bytes live in Cache Storage under yantra-audio-v1, as complete
   responses. A partial (206) copy is never stored. Spotify is not part of this. */
(function (root) {
  const AUDIO = "yantra-audio-v1";

  function albumPaths(recordings, albumId) {
    const files = recordings && recordings[albumId];
    if (!files || typeof files !== "object") return [];
    return Object.keys(files)
      .sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b)))
      .map((key) => files[key])
      .filter((path) => typeof path === "string" && /^[a-z0-9-]+\/\d{2}\.mp3$/.test(path));
  }

  function audioUrl(path, origin) {
    const clean = String(path || "").replace(/^\/+/, "");
    const base = origin ? String(origin).replace(/\/$/, "") : "";
    return base + "/web/audio/" + clean;
  }

  function formatBytes(n) {
    const bytes = Math.max(0, Math.round(Number(n) || 0));
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    const mb = bytes / (1024 * 1024);
    const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
    return rounded + " MB";
  }

  function responseBytes(response) {
    if (!response || !response.headers) return 0;
    const size = Number(response.headers.get("content-length"));
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  function keptAlbumIds(recordings, cachedUrls, origin) {
    const have = new Set(cachedUrls || []);
    const ids = [];
    Object.keys(recordings || {}).forEach((id) => {
      const paths = albumPaths(recordings, id);
      if (!paths.length) return;
      if (paths.every((path) => have.has(audioUrl(path, origin)))) ids.push(id);
    });
    return ids;
  }

  /* What the quiet control says. Incomplete albums stay hidden on the shelf
     while offline; here they can still be finished or removed. */
  function packView(info, offline) {
    const row = info || {};
    const have = Number(row.have) || 0;
    const total = Number(row.total) || 0;
    const bytes = Number(row.bytes) || 0;
    const percent = total > 0 ? Math.min(100, Math.round((have / total) * 100)) : 0;
    if (row.busy) {
      return {
        action: "Stop",
        secondary: "",
        detail: "Keeping " + have + " of " + total + (bytes ? " · " + formatBytes(bytes) : ""),
        meter: percent,
      };
    }
    if (row.complete) {
      return {
        action: "Remove",
        secondary: "",
        detail: "On this device · " + formatBytes(bytes),
        meter: null,
      };
    }
    if (offline) {
      return {
        action: have > 0 ? "Remove" : "",
        secondary: "",
        detail: have > 0 ? (have + " of " + total + " kept · connect to finish") : "Connect to keep this album",
        meter: null,
      };
    }
    if (row.error) {
      return {
        action: "Try again",
        secondary: have > 0 ? "Remove" : "",
        detail: "Could not finish. Try again on the network.",
        meter: null,
      };
    }
    if (have > 0) {
      return {
        action: "Keep offline",
        secondary: "Remove",
        detail: have + " of " + total + " · " + formatBytes(bytes),
        meter: null,
      };
    }
    return { action: "Keep offline", secondary: "", detail: "", meter: null };
  }

  async function openCache(cache) {
    if (cache) return cache;
    return caches.open(AUDIO);
  }

  async function inventory(recordings, options) {
    const opts = options || {};
    const origin = opts.origin || "";
    const cache = await openCache(opts.cache);
    const keys = typeof cache.keys === "function" ? await cache.keys() : [];
    const urls = [];
    for (const key of keys) urls.push(typeof key === "string" ? key : key.url);
    const albums = {};
    for (const id of Object.keys(recordings || {})) {
      const paths = albumPaths(recordings, id);
      if (!paths.length) continue;
      let have = 0;
      let bytes = 0;
      for (const path of paths) {
        const url = audioUrl(path, origin);
        if (urls.indexOf(url) < 0) continue;
        const hit = await cache.match(url);
        if (!hit || hit.status !== 200) continue;
        const size = responseBytes(hit);
        if (hit.headers && hit.headers.has("content-length") && size <= 0) continue;
        have += 1;
        bytes += size;
      }
      albums[id] = {
        have: have,
        total: paths.length,
        bytes: bytes,
        complete: have === paths.length,
        busy: false,
        error: false,
      };
    }
    return {
      albums: albums,
      cachedAlbumIds: Object.keys(albums).filter((id) => albums[id].complete),
    };
  }

  async function storeAlbum(albumId, recordings, options) {
    const opts = options || {};
    const paths = albumPaths(recordings, albumId);
    const origin = opts.origin || "";
    const cache = await openCache(opts.cache);
    const fetchImpl = opts.fetch || fetch;
    let done = 0;
    let bytes = 0;
    for (const path of paths) {
      if (opts.signal && opts.signal.aborted) {
        const stopped = new Error("stopped");
        stopped.name = "AbortError";
        throw stopped;
      }
      const url = audioUrl(path, origin);
      const hit = await cache.match(url);
      if (hit && hit.status === 200 && responseBytes(hit) > 0) {
        bytes += responseBytes(hit);
        done += 1;
        if (opts.onProgress) opts.onProgress({ albumId: albumId, done: done, total: paths.length, bytes: bytes, path: path });
        continue;
      }
      const response = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        signal: opts.signal,
      });
      if (!response || response.status !== 200) {
        const incomplete = new Error("incomplete");
        incomplete.name = "Incomplete";
        throw incomplete;
      }
      const blob = await response.blob();
      if (!blob || !blob.size) {
        const incomplete = new Error("incomplete");
        incomplete.name = "Incomplete";
        throw incomplete;
      }
      const stored = new Response(blob, {
        status: 200,
        headers: {
          "content-type": (response.headers && response.headers.get("content-type")) || "audio/mpeg",
          "content-length": String(blob.size),
          "accept-ranges": "bytes",
        },
      });
      await cache.put(url, stored);
      bytes += blob.size;
      done += 1;
      if (opts.onProgress) opts.onProgress({ albumId: albumId, done: done, total: paths.length, bytes: bytes, path: path });
    }
    return { albumId: albumId, done: done, total: paths.length, bytes: bytes, complete: paths.length > 0 && done === paths.length };
  }

  async function removeAlbum(albumId, recordings, options) {
    const opts = options || {};
    const cache = await openCache(opts.cache);
    const origin = opts.origin || "";
    for (const path of albumPaths(recordings, albumId)) {
      await cache.delete(audioUrl(path, origin));
    }
  }

async function clearKept() {
  if (typeof caches === "undefined" || !caches.keys) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key === AUDIO || /^yantra-v\d+$/.test(key)).map((key) => caches.delete(key)));
}

  const api = {
    AUDIO: AUDIO,
    albumPaths: albumPaths,
    audioUrl: audioUrl,
    formatBytes: formatBytes,
    keptAlbumIds: keptAlbumIds,
    packView: packView,
    inventory: inventory,
    storeAlbum: storeAlbum,
    removeAlbum: removeAlbum,
    clearKept: clearKept,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraOffline = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : null));
