/* Albums and Dharma talks kept on this device for a sit without a network.
   The bytes live in Cache Storage under yantra-audio-v1, as complete
   responses. A partial (206) copy is never stored. Spotify is not part of this.
   A talk list kept for the plane is titles only, and only on this device. */
(function (root) {
  const AUDIO = "yantra-audio-v1";
  const CATALOG_KEY = "yantra.talks.catalog.v1";
  const TALK_SRC = /^\/talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/;
  const TALK_KEY = /^talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/;

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

  function isTalkSrc(src) {
    const text = String(src || "");
    return TALK_SRC.test(text) && !text.includes("..");
  }

  function talkUrl(src, origin) {
    if (!isTalkSrc(src)) return "";
    const base = origin ? String(origin).replace(/\/$/, "") : "";
    return base + src;
  }

  function incomplete() {
    const error = new Error("incomplete");
    error.name = "Incomplete";
    return error;
  }

  function stopped() {
    const error = new Error("stopped");
    error.name = "AbortError";
    return error;
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

  /* One talk, same words as an album: keep it, show that it is here, or take it off. */
  function talkView(info, offline) {
    const row = info || {};
    const bytes = Number(row.bytes) || 0;
    const total = Number(row.total) || 0;
    const percent = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null;
    const size = bytes ? " · " + formatBytes(bytes) : "";
    if (row.busy) {
      return {
        action: "Stop",
        secondary: "",
        detail: "Keeping" + size,
        meter: percent,
      };
    }
    if (row.complete) {
      return {
        action: "Remove",
        secondary: "",
        detail: "On this device" + size,
        meter: null,
      };
    }
    if (offline) {
      return { action: "", secondary: "", detail: "", meter: null };
    }
    if (row.error) {
      return {
        action: "Try again",
        secondary: "",
        detail: "Could not finish. Try again on the network.",
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

  async function readComplete(response, opts, src) {
    const type = (response.headers && response.headers.get("content-type")) || "audio/mpeg";
    const expected = Number(response.headers && response.headers.get("content-length")) || 0;
    const reader = response.body && typeof response.body.getReader === "function" ? response.body.getReader() : null;
    if (!reader) {
      const blob = await response.blob();
      if (!blob || !blob.size || (expected && blob.size !== expected)) throw incomplete();
      if (opts.onProgress) opts.onProgress({ src: src, bytes: blob.size, total: expected || blob.size, done: true });
      return blob;
    }
    const chunks = [];
    let bytes = 0;
    let noted = 0;
    try {
      while (true) {
        if (opts.signal && opts.signal.aborted) throw stopped();
        const step = await reader.read();
        if (step.done) break;
        if (!step.value || !step.value.byteLength) continue;
        chunks.push(step.value);
        bytes += step.value.byteLength;
        if (opts.onProgress && (bytes - noted >= 262144 || (expected && bytes >= expected))) {
          noted = bytes;
          opts.onProgress({ src: src, bytes: bytes, total: expected, done: false });
        }
      }
    } catch (err) {
      try { await reader.cancel(); } catch (e) {}
      throw err;
    }
    if (!bytes || (expected && bytes !== expected)) throw incomplete();
    return new Blob(chunks, { type: type });
  }

  async function inventoryTalks(srcs, options) {
    const opts = options || {};
    const origin = opts.origin || "";
    const cache = await openCache(opts.cache);
    const seen = [];
    (srcs || []).forEach((src) => {
      if (isTalkSrc(src) && seen.indexOf(src) < 0) seen.push(src);
    });
    const talks = {};
    const kept = [];
    for (const src of seen) {
      const url = talkUrl(src, origin);
      const hit = await cache.match(url);
      const size = responseBytes(hit);
      const complete = !!(hit && hit.status === 200 && size > 0);
      talks[src] = { bytes: complete ? size : 0, complete: complete };
      if (complete) kept.push(src);
    }
    return { kept: kept, talks: talks };
  }

  async function storeTalk(src, options) {
    const opts = options || {};
    if (!isTalkSrc(src)) throw incomplete();
    if (opts.signal && opts.signal.aborted) throw stopped();
    const origin = opts.origin || "";
    const url = talkUrl(src, origin);
    const cache = await openCache(opts.cache);
    const fetchImpl = opts.fetch || fetch;
    const hit = await cache.match(url);
    if (hit && hit.status === 200 && responseBytes(hit) > 0) {
      const size = responseBytes(hit);
      if (opts.onProgress) opts.onProgress({ src: src, bytes: size, total: size, done: true });
      return { src: src, bytes: size, complete: true };
    }
    const response = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: opts.signal,
    });
    if (!response || response.status !== 200) throw incomplete();
    const blob = await readComplete(response, opts, src);
    const stored = new Response(blob, {
      status: 200,
      headers: {
        "content-type": blob.type || "audio/mpeg",
        "content-length": String(blob.size),
        "accept-ranges": "bytes",
      },
    });
    await cache.put(url, stored);
    if (opts.onProgress) opts.onProgress({ src: src, bytes: blob.size, total: blob.size, done: true });
    return { src: src, bytes: blob.size, complete: true };
  }

  async function removeTalk(src, options) {
    const opts = options || {};
    const url = talkUrl(src, opts.origin || "");
    if (!url) return;
    const cache = await openCache(opts.cache);
    await cache.delete(url);
  }

  function catalogStore(store) {
    if (store) return store;
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (e) {}
    return null;
  }

  function slimCatalog(data) {
    if (!data || !Array.isArray(data.sets)) return null;
    const slim = {
      heading: String(data.heading || "Talks").slice(0, 80),
      note: String(data.note || "").slice(0, 240),
      sets: [],
    };
    for (const set of data.sets.slice(0, 40)) {
      if (!set || !Array.isArray(set.talks)) continue;
      const talks = [];
      for (const talk of set.talks.slice(0, 80)) {
        const key = String(talk && talk.key || "");
        if (!TALK_KEY.test(key) || key.includes("..")) continue;
        const title = String(talk.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
        if (!title) continue;
        talks.push({
          title: title,
          key: key,
          seconds: Math.max(0, Math.round(Number(talk.seconds) || 0)),
        });
      }
      if (!talks.length) continue;
      slim.sets.push({
        id: String(set.id || "").slice(0, 80),
        title: String(set.title || "").replace(/\s+/g, " ").trim().slice(0, 120),
        talks: talks,
      });
    }
    return slim.sets.length ? slim : null;
  }

  function saveCatalog(data, store) {
    const kept = catalogStore(store);
    const slim = slimCatalog(data);
    if (!kept || !slim) return false;
    try {
      kept.setItem(CATALOG_KEY, JSON.stringify(slim));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadCatalog(store) {
    const kept = catalogStore(store);
    if (!kept) return null;
    try {
      return slimCatalog(JSON.parse(kept.getItem(CATALOG_KEY) || "null"));
    } catch (e) {
      return null;
    }
  }

  function clearCatalog(store) {
    const kept = catalogStore(store);
    if (!kept) return;
    try { kept.removeItem(CATALOG_KEY); } catch (e) {}
  }

  async function clearTalks(options) {
    const opts = options || {};
    clearCatalog(opts.store);
    let cache = opts.cache;
    if (!cache) {
      if (typeof caches === "undefined" || !caches.open) return;
      cache = await caches.open(AUDIO);
    }
    if (!cache || typeof cache.keys !== "function") return;
    const keys = await cache.keys();
    for (const key of keys) {
      const url = typeof key === "string" ? key : (key && key.url) || "";
      let path = "";
      try { path = new URL(url).pathname; } catch (e) { path = ""; }
      if (isTalkSrc(path)) await cache.delete(url);
    }
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
    CATALOG_KEY: CATALOG_KEY,
    albumPaths: albumPaths,
    audioUrl: audioUrl,
    isTalkSrc: isTalkSrc,
    talkUrl: talkUrl,
    formatBytes: formatBytes,
    keptAlbumIds: keptAlbumIds,
    packView: packView,
    talkView: talkView,
    inventory: inventory,
    inventoryTalks: inventoryTalks,
    storeAlbum: storeAlbum,
    storeTalk: storeTalk,
    removeAlbum: removeAlbum,
    removeTalk: removeTalk,
    saveCatalog: saveCatalog,
    loadCatalog: loadCatalog,
    clearCatalog: clearCatalog,
    clearTalks: clearTalks,
    clearKept: clearKept,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraOffline = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : null));
