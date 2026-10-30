/* Mindfulness listening for the web edition.
 *
 * Album playback and Dharma talks accumulate here. Morning and evening sits
 * stay in yantra.practice.v1 and are never added into this total. The record
 * stays on this device. A linked device uploads it only as ciphertext, beside
 * the formal days, and sync.js merges it once per device.
 */
(function (root) {
  const KEY = "yantra.listening.v1";
  const ALBUM_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
  const TALK_SRC = /^\/talks\/[a-z0-9][a-z0-9./_-]{0,180}\.mp3$/;

  function empty() {
    return {
      version: 1,
      totals: { ms: 0 },
      albums: {},
      talks: {},
      earlier: { ms: 0 },
      open: null,
    };
  }

  function localDate(date) {
    const d = date instanceof Date ? date : new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function addDays(iso, n) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !part && part !== 0)) return "";
    const next = new Date(parts[0], parts[1] - 1, parts[2] + n);
    return localDate(next);
  }

  function validKey(kind, key) {
    const text = String(key || "");
    if (kind === "talk") return TALK_SRC.test(text) && text.indexOf("..") < 0;
    return ALBUM_ID.test(text);
  }

  function readRow(row) {
    if (typeof row === "number") return { ms: Math.max(0, row), lastAt: 0 };
    const src = row || {};
    return {
      ms: Math.max(0, Number(src.ms) || 0),
      lastAt: Math.max(0, Number(src.lastAt) || 0),
    };
  }

  function readMap(raw, kind) {
    const out = {};
    const src = raw && typeof raw === "object" ? raw : {};
    Object.keys(src).forEach((key) => {
      if (!validKey(kind, key)) return;
      const row = readRow(src[key]);
      if (row.ms <= 0 && row.lastAt <= 0) return;
      out[key] = row;
    });
    return out;
  }

  function recompute(store) {
    let ms = Math.max(0, Number(store.earlier && store.earlier.ms) || 0);
    Object.keys(store.albums || {}).forEach((key) => { ms += store.albums[key].ms; });
    Object.keys(store.talks || {}).forEach((key) => { ms += store.talks[key].ms; });
    store.totals = { ms: ms };
    return store;
  }

  function normalize(raw) {
    const store = empty();
    if (!raw || typeof raw !== "object") return store;
    store.albums = readMap(raw.albums, "album");
    store.talks = readMap(raw.talks, "talk");
    store.earlier = { ms: Math.max(0, Number(raw.earlier && raw.earlier.ms) || 0) };
    if (raw.open && typeof raw.open === "object") {
      const kind = raw.open.kind === "talk" ? "talk" : "album";
      const parts = readMap(raw.open.parts, kind);
      const keys = Object.keys(parts);
      if (keys.length) {
        store.open = {
          kind: kind,
          parts: parts,
          lastAt: Math.max(0, Number(raw.open.lastAt) || 0),
          at: Math.max(0, Number(raw.open.at) || 0),
        };
      }
    }
    return recompute(store);
  }

  function storage() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function load() {
    const kept = storage();
    if (!kept) return empty();
    try { return normalize(JSON.parse(kept.getItem(KEY) || "null")); }
    catch (e) { return empty(); }
  }

  function save(store) {
    const kept = storage();
    if (!kept) return;
    try { kept.setItem(KEY, JSON.stringify(normalize(store))); } catch (e) {}
  }

  let viewOf = null;
  const committers = [];
  const erasers = [];

  function setView(fn) { viewOf = typeof fn === "function" ? fn : null; }
  function onCommit(fn) { if (typeof fn === "function") committers.push(fn); }
  function onErase(fn) { if (typeof fn === "function") erasers.push(fn); }

  function notify(list, arg) {
    list.slice().forEach((fn) => {
      try { fn(arg); } catch (e) {}
    });
  }

  function loadView() {
    const local = load();
    if (!viewOf) return local;
    try {
      const viewed = viewOf(local);
      if (!viewed || typeof viewed !== "object") return local;
      return normalize(viewed);
    } catch (e) {
      return local;
    }
  }

  function bucket(kind) {
    return kind === "talk" ? "talks" : "albums";
  }

  function apply(store, heard) {
    const next = normalize(store);
    next.open = null;
    if (!heard || typeof heard !== "object") return { store: next, added: 0 };
    const kind = heard.kind === "talk" ? "talk" : "album";
    const name = bucket(kind);
    const lastAt = Math.max(0, Number(heard.lastAt) || 0);
    let added = 0;
    const parts = heard.parts && typeof heard.parts === "object" ? heard.parts : {};
    Object.keys(parts).forEach((key) => {
      if (!validKey(kind, key)) return;
      const ms = Math.max(0, Number(parts[key] && parts[key].ms != null ? parts[key].ms : parts[key]) || 0);
      if (ms <= 0) return;
      const row = readRow(next[name][key]);
      row.ms += ms;
      if (lastAt > row.lastAt) row.lastAt = lastAt;
      next[name][key] = row;
      added += ms;
    });
    recompute(next);
    return { store: next, added: added };
  }

  function absorbEarlier(ms) {
    const add = Math.max(0, Number(ms) || 0);
    if (!add) return load();
    const store = load();
    store.earlier.ms += add;
    recompute(store);
    save(store);
    notify(committers, { store: store, added: add });
    return store;
  }

  function absorbPending() {
    const Practice = root && root.YantraPractice;
    if (!Practice || typeof Practice.takeMigratedEarlier !== "function") return load();
    return absorbEarlier(Practice.takeMigratedEarlier());
  }

  function commit(heard) {
    const result = apply(load(), heard);
    save(result.store);
    if (result.added > 0) notify(committers, result);
    return result;
  }

  function checkpoint(heard) {
    if (!heard || typeof heard !== "object") return;
    const kind = heard.kind === "talk" ? "talk" : "album";
    const parts = readMap(heard.parts, kind);
    if (!Object.keys(parts).length) return;
    const store = load();
    store.open = {
      kind: kind,
      parts: parts,
      lastAt: Math.max(0, Number(heard.lastAt) || 0),
      at: Date.now(),
    };
    save(store);
  }

  function recover() {
    absorbPending();
    const store = load();
    if (!store.open) return store;
    const open = store.open;
    const result = apply(store, open);
    save(result.store);
    if (result.added > 0) notify(committers, result);
    return result.store;
  }

  function erase() {
    const kept = storage();
    if (kept) {
      try { kept.removeItem(KEY); } catch (e) {}
    }
    notify(erasers);
  }

  /* Once per device. Time adds. The later last-listened wins. The total is
     recomputed from albums, talks, and earlier, and is never the formal total. */
  function merge(logs) {
    const out = empty();
    const seen = new Set();
    (Array.isArray(logs) ? logs : []).forEach((log) => {
      if (!log || typeof log !== "object") return;
      const id = typeof log.deviceId === "string" ? log.deviceId : "";
      if (!id || seen.has(id)) return;
      seen.add(id);
      const src = normalize(log.listening || log);
      ["albums", "talks"].forEach((name) => {
        Object.keys(src[name]).forEach((key) => {
          const row = readRow(out[name][key]);
          const add = src[name][key];
          row.ms += add.ms;
          if (add.lastAt > row.lastAt) row.lastAt = add.lastAt;
          out[name][key] = row;
        });
      });
      out.earlier.ms += src.earlier.ms;
    });
    return recompute(out);
  }

  function syncPayload(store) {
    const clean = normalize(store);
    return {
      albums: clean.albums,
      talks: clean.talks,
      earlier: { ms: clean.earlier.ms },
    };
  }

  function formatSpan(ms) {
    const total = Math.round((Number(ms) || 0) / 60000);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours <= 0) return total === 1 ? "1 minute" : total + " minutes";
    const hourLabel = hours === 1 ? "1 hour" : hours + " hours";
    if (minutes === 0) return hourLabel;
    return hourLabel + " " + (minutes === 1 ? "1 minute" : minutes + " minutes");
  }

  function formatWhen(at, now) {
    const t = Number(at) || 0;
    if (!t) return "";
    const date = new Date(t);
    const today = localDate(now instanceof Date ? now : new Date());
    const day = localDate(date);
    if (day === today) return "today";
    if (day === addDays(today, -1)) return "yesterday";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[date.getMonth()] + " " + date.getDate();
  }

  function shown(ms) {
    return Math.round((Number(ms) || 0) / 60000) >= 1;
  }

  /* What this word may see. Gated albums and talks stay in the store. */
  function rowsFor(store, options) {
    const opts = options || {};
    const level = opts.level === "zazen" ? "zazen" : "";
    const titles = {};
    (opts.discs || []).forEach((disc) => {
      if (disc && disc.id && disc.title) titles[String(disc.id)] = String(disc.title);
    });
    const talkTitles = opts.talkTitles || {};
    const clean = normalize(store);
    const now = opts.now instanceof Date ? opts.now : new Date();
    const items = [];
    let visibleMs = clean.earlier.ms;
    Object.keys(clean.albums).forEach((id) => {
      if (!titles[id]) return;
      const row = clean.albums[id];
      visibleMs += row.ms;
      if (!shown(row.ms)) return;
      const when = formatWhen(row.lastAt, now);
      items.push({
        kind: "album",
        id: id,
        title: titles[id],
        ms: row.ms,
        lastAt: row.lastAt,
        detail: formatSpan(row.ms) + (when ? " · " + when : ""),
      });
    });
    if (level === "zazen") {
      Object.keys(clean.talks).forEach((src) => {
        const title = talkTitles[src];
        if (!title) return;
        const row = clean.talks[src];
        visibleMs += row.ms;
        if (!shown(row.ms)) return;
        const when = formatWhen(row.lastAt, now);
        items.push({
          kind: "talk",
          id: src,
          title: String(title),
          ms: row.ms,
          lastAt: row.lastAt,
          detail: formatSpan(row.ms) + (when ? " · " + when : ""),
        });
      });
    }
    items.sort((a, b) => (b.lastAt - a.lastAt) || String(a.title).localeCompare(String(b.title)));
    const earlier = shown(clean.earlier.ms) ? clean.earlier.ms : 0;
    return {
      items: items,
      earlier: earlier,
      visibleMs: visibleMs,
      totalLine: shown(visibleMs) ? "Mindfulness · " + formatSpan(visibleMs) : "",
    };
  }

  function rowOf(kind, key) {
    const store = loadView();
    const name = bucket(kind === "talk" ? "talk" : "album");
    return store[name][String(key || "")] || null;
  }

  function albumLine(id, now) {
    const row = rowOf("album", id);
    if (!row || !shown(row.ms)) return "";
    const when = formatWhen(row.lastAt, now instanceof Date ? now : new Date());
    return formatSpan(row.ms) + (when ? " · last listened " + when : "");
  }

  function talkLine(src) {
    const row = rowOf("talk", src);
    if (!row || !shown(row.ms)) return "";
    return "heard " + formatSpan(row.ms);
  }

  function partId(kind, sampleKey) {
    const text = String(sampleKey || "");
    if (!text) return "";
    if (kind === "talk") return text;
    const cut = text.indexOf("#");
    return cut >= 0 ? text.slice(0, cut) : text;
  }

  /* Playback clock. A forward seek does not count; time the playhead was
     actually moving does. Album changes split the time by album id. */
  function createClock(now) {
    const clock = now || function () { return Date.now(); };
    let kind = "album";
    let parts = {};
    let key = "";
    let ms = 0;
    let last = null;
    let on = false;
    let lastAt = 0;
    function flush() {
      if (key && ms > 0) parts[key] = (parts[key] || 0) + ms;
      ms = 0;
    }
    return {
      begin(nextKind) {
        kind = nextKind === "talk" ? "talk" : "album";
        parts = {};
        key = "";
        ms = 0;
        last = null;
        on = true;
        lastAt = 0;
      },
      active() { return on; },
      observe(sample) {
        if (!on || !sample) return;
        const at = sample.at == null ? clock() : sample.at;
        const next = partId(kind, sample.key);
        if (last && last.playing && last.track === sample.key && typeof sample.position === "number" && typeof last.position === "number") {
          const moved = sample.position - last.position;
          const wall = (at - last.at) / 1000;
          if (moved > 0 && wall >= 0) {
            const counted = moved > wall + 1.5 ? wall : moved;
            if (counted > 0) {
              ms += counted * 1000;
              lastAt = at;
            }
          }
        }
        if (next && next !== key) {
          flush();
          key = next;
        }
        last = { track: sample.key, position: sample.position, playing: !!sample.playing, at: at };
      },
      snapshot() {
        const copy = {};
        Object.keys(parts).forEach((id) => { copy[id] = parts[id]; });
        if (key && ms > 0) copy[key] = (copy[key] || 0) + ms;
        return { kind: kind, parts: copy, lastAt: lastAt };
      },
      end() {
        flush();
        const heardParts = {};
        Object.keys(parts).forEach((id) => { heardParts[id] = parts[id]; });
        const heard = { kind: kind, parts: heardParts, lastAt: lastAt };
        on = false;
        parts = {};
        key = "";
        ms = 0;
        last = null;
        lastAt = 0;
        kind = "album";
        return heard;
      },
    };
  }

  const albumClock = createClock();
  const talkClock = createClock();

  function beginAlbum() { albumClock.begin("album"); }
  function albumActive() { return albumClock.active(); }
  function observeAlbum(sample) { albumClock.observe(sample); }
  function checkpointAlbum() {
    if (albumClock.active()) checkpoint(albumClock.snapshot());
  }
  function endAlbum() {
    if (!albumClock.active()) return { store: load(), added: 0 };
    return commit(albumClock.end());
  }

  function observeTalk(sample) {
    if (!talkClock.active()) talkClock.begin("talk");
    talkClock.observe(sample);
  }
  function checkpointTalk() {
    if (talkClock.active()) checkpoint(talkClock.snapshot());
  }
  function endTalk() {
    if (!talkClock.active()) return { store: load(), added: 0 };
    return commit(talkClock.end());
  }

  function exportData() {
    const store = loadView();
    return {
      totals: { ms: store.totals.ms },
      albums: store.albums,
      talks: store.talks,
      earlier: { ms: store.earlier.ms },
    };
  }

  if (root && typeof root.addEventListener === "function") {
    const keep = () => {
      checkpointAlbum();
      checkpointTalk();
    };
    root.addEventListener("pagehide", keep);
    if (root.document && typeof root.document.addEventListener === "function") {
      root.document.addEventListener("visibilitychange", () => {
        if (root.document.visibilityState === "hidden") keep();
      });
    }
    root.setInterval(keep, 15000);
  }

  const api = {
    KEY: KEY,
    empty: empty,
    normalize: normalize,
    load: load,
    save: save,
    erase: erase,
    absorbEarlier: absorbEarlier,
    absorbPending: absorbPending,
    apply: apply,
    commit: commit,
    checkpoint: checkpoint,
    recover: recover,
    merge: merge,
    syncPayload: syncPayload,
    setView: setView,
    onCommit: onCommit,
    onErase: onErase,
    loadView: loadView,
    formatSpan: formatSpan,
    formatWhen: formatWhen,
    rowsFor: rowsFor,
    albumLine: albumLine,
    talkLine: talkLine,
    createClock: createClock,
    beginAlbum: beginAlbum,
    albumActive: albumActive,
    observeAlbum: observeAlbum,
    checkpointAlbum: checkpointAlbum,
    endAlbum: endAlbum,
    observeTalk: observeTalk,
    checkpointTalk: checkpointTalk,
    endTalk: endTalk,
    exportData: exportData,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraListening = api;
})(typeof window !== "undefined" ? window : null);
