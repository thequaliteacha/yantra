/* Cross-device practice, without an account.
 *
 * A practice key is 256 random bits. It stays in this browser and in a link
 * fragment (#link=...), which the network never receives. HKDF turns it into
 * a lookup id (a one-way hash of the key) and an AES-GCM key. The server
 * stores the lookup id and the ciphertext. Each device uploads only its own
 * days; the merged view sums those days once per device.
 */
(function (root) {
  const Practice = (root && root.YantraPractice) || require("./practice.js");
  const STATE_KEY = "yantra.practice.sync.v1";
  const NOTE_KEY = "yantra.practice.sync.note";
  const LINK_ORIGIN = "https://yantramedi.app/web/#link=";
  const DEVICE_ID = /^[0-9a-f]{32}$/;
  const SALT = new TextEncoder().encode("yantra.practice.v1");
  const LOOKUP_INFO = new TextEncoder().encode("yantra.practice.lookup");
  const AES_INFO = new TextEncoder().encode("yantra.practice.aes-gcm");

  let revision = 0;
  let chain = Promise.resolve();
  let qrFor = "";
  let qrShown = false;
  let editingId = "";
  let removeId = "";
  const nativeFetch = root && root.fetch ? root.fetch.bind(root) : null;

  function storage() {
    try {
      const store = root && root.localStorage ? root.localStorage : (typeof localStorage !== "undefined" ? localStorage : null);
      return store || null;
    } catch (e) {
      return null;
    }
  }

  function bytesToB64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function b64urlToBytes(text) {
    const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
    const bin = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i) & 255;
    return out;
  }

  function bytesToHex(bytes) {
    let out = "";
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < view.length; i += 1) out += view[i].toString(16).padStart(2, "0");
    return out;
  }

  const NAME_MAX = 24;

  function cleanName(value) {
    return String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
  }

  function stampOf(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 0;
    return Math.floor(n);
  }

  function labelsFrom(raw) {
    const labels = {};
    if (!raw || typeof raw !== "object") return labels;
    Object.keys(raw).forEach((id) => {
      if (!DEVICE_ID.test(id)) return;
      const row = raw[id] || {};
      const name = cleanName(row.name);
      const at = stampOf(row.at);
      if (!name && !at) return;
      labels[id] = { name: name, at: at || 1 };
    });
    return labels;
  }

  function randomBytes(size) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function generatePracticeKey() {
    return bytesToB64url(randomBytes(32));
  }

  function randomDeviceId() {
    return bytesToHex(randomBytes(16));
  }

  /* A raw key, or a link that carries one in the fragment. */
  function parseKey(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    let key = raw;
    const hashAt = raw.indexOf("#");
    if (hashAt >= 0) {
      key = new URLSearchParams(raw.slice(hashAt + 1)).get("link") || "";
    } else if (/^https?:/i.test(raw)) {
      try {
        key = new URLSearchParams(new URL(raw).hash.replace(/^#/, "")).get("link") || "";
      } catch (e) {
        return "";
      }
    }
    key = String(key || "").trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return "";
    try {
      if (b64urlToBytes(key).length !== 32) return "";
    } catch (e) {
      return "";
    }
    return key;
  }

  function linkFor(practiceKey) {
    return LINK_ORIGIN + practiceKey;
  }

  function emptyState() {
    return { practiceKey: "", deviceId: "", name: "", namedAt: 0, labels: {}, peers: {}, pending: false };
  }

  function peersFrom(raw) {
    const peers = {};
    if (!raw || typeof raw !== "object") return peers;
    Object.keys(raw).forEach((id) => {
      if (!DEVICE_ID.test(id)) return;
      const row = raw[id] || {};
      peers[id] = {
        name: cleanName(row.name),
        namedAt: stampOf(row.namedAt),
        days: Practice.normalize({ days: row.days }).days,
        labels: labelsFrom(row.labels),
      };
    });
    return peers;
  }

  function loadState() {
    const kept = storage();
    if (!kept) return emptyState();
    try {
      const raw = JSON.parse(kept.getItem(STATE_KEY) || "null");
      if (!raw || typeof raw !== "object") return emptyState();
      const practiceKey = parseKey(raw.practiceKey) || "";
      const deviceId = DEVICE_ID.test(raw.deviceId || "") ? raw.deviceId : "";
      return {
        practiceKey: practiceKey,
        deviceId: practiceKey ? deviceId : "",
        name: cleanName(raw.name),
        namedAt: stampOf(raw.namedAt),
        labels: practiceKey ? labelsFrom(raw.labels) : {},
        peers: practiceKey ? peersFrom(raw.peers) : {},
        pending: raw.pending === true,
      };
    } catch (e) {
      return emptyState();
    }
  }

  function saveState(state) {
    const kept = storage();
    if (!kept) return;
    const next = {
      practiceKey: state.practiceKey || "",
      deviceId: state.deviceId || "",
      name: cleanName(state.name),
      namedAt: stampOf(state.namedAt),
      labels: labelsFrom(state.labels),
      peers: peersFrom(state.peers),
      pending: state.pending === true,
    };
    try { kept.setItem(STATE_KEY, JSON.stringify(next)); } catch (e) {}
  }

  function clearState() {
    const kept = storage();
    if (!kept) return;
    try { kept.removeItem(STATE_KEY); } catch (e) {}
  }

  function noteText() {
    const kept = storage();
    if (!kept) return "";
    try { return kept.getItem(NOTE_KEY) || ""; } catch (e) { return ""; }
  }

  function setNote(text) {
    const kept = storage();
    const value = text ? String(text) : "";
    if (kept) {
      try {
        if (value) kept.setItem(NOTE_KEY, value);
        else kept.removeItem(NOTE_KEY);
      } catch (e) {}
    }
    const node = root && root.document ? root.document.getElementById("practice-link-note") : null;
    if (node) node.textContent = value;
  }

  function bump() {
    revision += 1;
  }

  function linked() {
    const state = loadState();
    return !!(state.practiceKey && state.deviceId);
  }

  function ruleLine() {
    return linked() ? "A minute of listening counts as a sit. Linked devices share the days." : Practice.RULE;
  }

  /* The streaks and the practice page read this. Local days stay untouched. */
  function currentStore() {
    const local = Practice.load();
    const viewed = viewOf(local);
    return viewed || local;
  }

  function viewOf(local) {
    const state = loadState();
    if (!state.practiceKey || !state.deviceId) return null;
    const logs = [{ deviceId: state.deviceId, days: (local && local.days) || {} }];
    Object.keys(state.peers).forEach((id) => {
      if (id === state.deviceId) return;
      logs.push({ deviceId: id, days: state.peers[id].days || {} });
    });
    const days = Practice.mergeDays(logs);
    return {
      version: 1,
      totals: Practice.totalsFromDays(days),
      days: days,
      milestones: (local && local.milestones) || [],
      reminders: local ? local.reminders : null,
      open: local ? local.open : null,
    };
  }

  async function derive(practiceKey) {
    const keyBytes = b64urlToBytes(parseKey(practiceKey) || practiceKey);
    if (keyBytes.length !== 32) throw new Error("key");
    const ikm = await crypto.subtle.importKey("raw", keyBytes, "HKDF", false, ["deriveBits"]);
    const lookupBits = await crypto.subtle.deriveBits({
      name: "HKDF",
      hash: "SHA-256",
      salt: SALT,
      info: LOOKUP_INFO,
    }, ikm, 256);
    const aesBits = await crypto.subtle.deriveBits({
      name: "HKDF",
      hash: "SHA-256",
      salt: SALT,
      info: AES_INFO,
    }, ikm, 256);
    const aesKey = await crypto.subtle.importKey("raw", aesBits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    return { lookupId: bytesToHex(lookupBits), aesKey: aesKey };
  }

  async function encrypt(aesKey, payload, deviceId) {
    const iv = randomBytes(12);
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const params = { name: "AES-GCM", iv: iv };
    if (deviceId) params.additionalData = new TextEncoder().encode(deviceId);
    const cipher = await crypto.subtle.encrypt(params, aesKey, encoded);
    return { iv: bytesToB64url(iv), ct: bytesToB64url(new Uint8Array(cipher)) };
  }

  async function decrypt(aesKey, envelope, deviceId) {
    const iv = b64urlToBytes(envelope && envelope.iv);
    const ct = b64urlToBytes(envelope && envelope.ct);
    if (iv.length !== 12 || ct.length < 16) throw new Error("envelope");
    const params = { name: "AES-GCM", iv: iv };
    if (deviceId) params.additionalData = new TextEncoder().encode(deviceId);
    const plain = await crypto.subtle.decrypt(params, aesKey, ct);
    const data = JSON.parse(new TextDecoder().decode(plain));
    if (!data || typeof data !== "object") throw new Error("plain");
    return data;
  }

  function netFetch(url, init) {
    const fn = nativeFetch || fetch;
    return fn(url, init);
  }

  function devicePath(lookupId, deviceId) {
    return "/api/practice/" + lookupId + "/" + deviceId;
  }

  function collectionPath(lookupId) {
    return "/api/practice/" + lookupId;
  }

  function failNote(status) {
    if (status === 429) return "Too many tries just now. Your sits are still here, and this device will try again.";
    if (status === 503) return "Sync is not available yet. Your sits stay on this device.";
    if (status === 413) return "The shared record is too large to send. Your sits are still on this device.";
    return "This device could not reach the others just now. Your sits are still here.";
  }

  function forgotten() {
    clearState();
    setNote("This practice key was forgotten. This device keeps the sits already here.");
    paint();
  }

  function removed() {
    clearState();
    setNote("This device was removed from the shared practice. The sits already here stay.");
    paint();
  }

  function markPending() {
    bump();
    const state = loadState();
    if (!state.practiceKey) return;
    state.pending = true;
    saveState(state);
  }

  async function syncOnce() {
    let state = loadState();
    if (!state.practiceKey) return { ok: true, skipped: true };
    if (!state.deviceId) {
      state.deviceId = randomDeviceId();
      state.pending = true;
      saveState(state);
    }
    let material;
    try {
      material = await derive(state.practiceKey);
    } catch (e) {
      setNote("This device could not use the practice key.");
      return { ok: false };
    }
    const local = Practice.load();
    const seen = revision;
    let envelope;
    try {
      envelope = await encrypt(material.aesKey, payloadOf(state, local), state.deviceId);
    } catch (e) {
      setNote(failNote(0));
      return { ok: false };
    }
    let uploaded = false;
    try {
      const put = await netFetch(devicePath(material.lookupId, state.deviceId), {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      if (put.status === 410) {
        forgotten();
        return { ok: false, forgotten: true };
      }
      if (put.status === 403) {
        removed();
        return { ok: false, removed: true };
      }
      if (!put.ok) {
        const latest = loadState();
        latest.pending = true;
        saveState(latest);
        setNote(failNote(put.status));
        return { ok: false, status: put.status };
      }
      uploaded = true;
    } catch (e) {
      const latest = loadState();
      latest.pending = true;
      saveState(latest);
      setNote(failNote(0));
      return { ok: false, offline: true };
    }
    if (uploaded && revision === seen) {
      const latest = loadState();
      latest.pending = false;
      saveState(latest);
    }
    try {
      const list = await netFetch(collectionPath(material.lookupId), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (list.status === 410) {
        forgotten();
        return { ok: false, forgotten: true };
      }
      if (!list.ok) {
        setNote(failNote(list.status));
        return { ok: uploaded, status: list.status };
      }
      const data = await list.json().catch(() => ({}));
      const devices = data && Array.isArray(data.devices) ? data.devices : [];
      const now = loadState();
      const nextPeers = {};
      for (let i = 0; i < devices.length; i += 1) {
        const device = devices[i];
        if (!device || device.id === now.deviceId || !DEVICE_ID.test(device.id || "")) continue;
        try {
          const plain = await decrypt(material.aesKey, device, device.id);
          nextPeers[device.id] = {
            name: cleanName(plain && plain.name),
            namedAt: stampOf(plain && plain.namedAt),
            days: Practice.normalize({ days: plain && plain.days }).days,
            labels: labelsFrom(plain && plain.labels),
          };
        } catch (e) {
          if (now.peers[device.id]) nextPeers[device.id] = now.peers[device.id];
        }
      }
      const saved = loadState();
      saved.peers = nextPeers;
      const book = labelBook(saved, nextPeers);
      const mine = book[saved.deviceId];
      const adopted = !!(mine && mine.at > stampOf(saved.namedAt) && (mine.name !== saved.name || mine.at !== stampOf(saved.namedAt)));
      if (adopted) {
        saved.name = mine.name;
        saved.namedAt = mine.at;
        saved.pending = true;
      }
      saveState(saved);
      if (adopted) {
        try {
          const again = await encrypt(material.aesKey, payloadOf(loadState(), Practice.load()), saved.deviceId);
          const put = await netFetch(devicePath(material.lookupId, saved.deviceId), {
            method: "PUT",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(again),
          });
          if (put.ok && revision === seen) {
            const quiet = loadState();
            quiet.pending = false;
            saveState(quiet);
          }
        } catch (e) {
          /* the adopted name stays pending and leaves on the next sync */
        }
      }
      if (uploaded) setNote("");
      paint();
      return { ok: true };
    } catch (e) {
      setNote(failNote(0));
      return { ok: uploaded, offline: true };
    }
  }

  function sync() {
    const run = chain.then(() => syncOnce());
    chain = run.catch(() => {});
    return run;
  }

  function settled() {
    return chain;
  }

  function linkNew(options) {
    const existing = loadState();
    if (existing.practiceKey) {
      if (!existing.deviceId) existing.deviceId = randomDeviceId();
      if (options && options.name != null) {
        existing.name = cleanName(options.name);
        existing.namedAt = Date.now();
      }
      existing.pending = true;
      bump();
      saveState(existing);
      return {
        practiceKey: existing.practiceKey,
        deviceId: existing.deviceId,
        link: linkFor(existing.practiceKey),
        created: false,
      };
    }
    const practiceKey = generatePracticeKey();
    const deviceId = existing.deviceId || randomDeviceId();
    bump();
    const named = cleanName(options && options.name);
    saveState({
      practiceKey: practiceKey,
      deviceId: deviceId,
      name: named,
      namedAt: named ? Date.now() : 0,
      labels: {},
      peers: {},
      pending: true,
    });
    setNote("");
    return { practiceKey: practiceKey, deviceId: deviceId, link: linkFor(practiceKey), created: true };
  }

  function join(text, options) {
    const practiceKey = parseKey(text);
    if (!practiceKey) return { ok: false, error: "That key did not work." };
    const existing = loadState();
    if (existing.practiceKey && existing.practiceKey !== practiceKey && existing.deviceId) {
      const oldKey = existing.practiceKey;
      const oldId = existing.deviceId;
      derive(oldKey).then((material) => netFetch(devicePath(material.lookupId, oldId), {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      })).catch(() => {});
    }
    const same = existing.practiceKey === practiceKey;
    const deviceId = existing.deviceId || randomDeviceId();
    const named = options && options.name != null ? cleanName(options.name) : (same ? existing.name : "");
    bump();
    saveState({
      practiceKey: practiceKey,
      deviceId: deviceId,
      name: named,
      namedAt: options && options.name != null ? (named ? Date.now() : 0) : (same ? existing.namedAt : 0),
      labels: same ? existing.labels : {},
      peers: same ? existing.peers : {},
      pending: true,
    });
    setNote("");
    return { ok: true, practiceKey: practiceKey, deviceId: deviceId, link: linkFor(practiceKey) };
  }

  async function unlink(options) {
    const force = !!(options && options.force);
    const state = loadState();
    if (state.practiceKey && state.deviceId) {
      try {
        const material = await derive(state.practiceKey);
        const response = await netFetch(devicePath(material.lookupId, state.deviceId), {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 410 || response.ok || response.status === 404) {
          /* gone already, or removed */
        } else if (!force) {
          setNote("Could not unlink yet. This device will try again.");
          return { ok: false };
        }
      } catch (e) {
        if (!force) {
          setNote("Could not unlink yet. Your sits are still here.");
          return { ok: false };
        }
      }
    }
    clearState();
    setNote(force ? "" : "This device is on its own again. The sits already here stay.");
    paint();
    return { ok: true };
  }

  async function removeDevice(deviceId) {
    const state = loadState();
    if (!state.practiceKey || !DEVICE_ID.test(deviceId || "") || deviceId === state.deviceId) return { ok: false };
    try {
      const material = await derive(state.practiceKey);
      const response = await netFetch(devicePath(material.lookupId, deviceId), {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!(response.ok || response.status === 404)) {
        setNote(failNote(response.status));
        return { ok: false };
      }
    } catch (e) {
      setNote(failNote(0));
      return { ok: false };
    }
    const latest = loadState();
    delete latest.peers[deviceId];
    if (latest.labels) delete latest.labels[deviceId];
    saveState(latest);
    setNote("");
    paint();
    return { ok: true };
  }

  async function forget() {
    const state = loadState();
    if (!state.practiceKey) {
      clearState();
      paint();
      return { ok: true };
    }
    try {
      const material = await derive(state.practiceKey);
      const response = await netFetch(collectionPath(material.lookupId), {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!(response.ok || response.status === 404 || response.status === 410)) {
        setNote("Could not forget the key just yet. It is still on this device.");
        return { ok: false };
      }
    } catch (e) {
      setNote("Could not reach the others just now. The key is still on this device.");
      return { ok: false };
    }
    clearState();
    setNote("The practice key is forgotten. This device keeps the sits already here.");
    paint();
    return { ok: true };
  }

  function payloadOf(state, local) {
    return {
      v: 1,
      name: state.name || "",
      namedAt: stampOf(state.namedAt) || 0,
      days: (local && local.days) || {},
      labels: labelsFrom(state.labels),
    };
  }

  /* Newest stamp wins. A name with no stamp counts as 1, so any real rename is newer. */
  function labelBook(state, peers) {
    const book = {};
    const consider = (id, name, at) => {
      if (!DEVICE_ID.test(id || "")) return;
      const clean = cleanName(name);
      let stamp = stampOf(at);
      if (!stamp) {
        if (!clean) return;
        stamp = 1;
      }
      const prev = book[id];
      if (!prev || stamp > prev.at) book[id] = { name: clean, at: stamp };
    };
    if (state && state.deviceId) consider(state.deviceId, state.name, state.namedAt);
    const ours = labelsFrom(state && state.labels);
    Object.keys(ours).forEach((id) => consider(id, ours[id].name, ours[id].at));
    Object.keys(peers || {}).forEach((id) => {
      const peer = peers[id] || {};
      consider(id, peer.name, peer.namedAt);
      const labels = labelsFrom(peer.labels);
      Object.keys(labels).forEach((target) => consider(target, labels[target].name, labels[target].at));
    });
    return book;
  }

  function rename(id, name) {
    const state = loadState();
    if (!state.practiceKey || !state.deviceId || !DEVICE_ID.test(id || "")) return "";
    const clean = cleanName(name);
    state.labels = labelsFrom(state.labels);
    if (id !== state.deviceId && !state.peers[id]) return clean;
    const seenAt = id === state.deviceId
      ? stampOf(state.namedAt)
      : Math.max(stampOf((state.labels[id] || {}).at), stampOf((state.peers[id] || {}).namedAt));
    let at = Date.now();
    if (at <= seenAt) at = seenAt + 1;
    if (id === state.deviceId) {
      if (clean === state.name && state.namedAt) return clean;
      state.name = clean;
      state.namedAt = at;
    } else {
      const prev = state.labels[id] || {};
      if (prev.name === clean && prev.at) return clean;
      state.labels = labelsFrom(state.labels);
      state.labels[id] = { name: clean, at: at };
    }
    state.pending = true;
    bump();
    saveState(state);
    return clean;
  }

  function setName(name) {
    const state = loadState();
    if (!state.practiceKey || !state.deviceId) return "";
    return rename(state.deviceId, name);
  }

  function devices() {
    const state = loadState();
    if (!state.practiceKey || !state.deviceId) return [];
    const book = labelBook(state, state.peers);
    const called = (id, fallback) => (book[id] ? book[id].name : (fallback || ""));
    const list = [{ id: state.deviceId, name: called(state.deviceId, state.name), self: true }];
    Object.keys(state.peers).sort().forEach((id) => {
      if (id === state.deviceId) return;
      list.push({ id: id, name: called(id, state.peers[id].name || ""), self: false });
    });
    return list;
  }

  function qrLib() {
    let lib = null;
    if (typeof qrcode === "function") lib = qrcode;
    else if (root && typeof root.qrcode === "function") lib = root.qrcode;
    else {
      try { lib = require("./qrcode.js"); } catch (e) { lib = null; }
    }
    if (lib && lib.stringToBytesFuncs && lib.stringToBytesFuncs["UTF-8"]) {
      lib.stringToBytes = lib.stringToBytesFuncs["UTF-8"];
    }
    return lib;
  }

  function qrMatrix(text) {
    const lib = qrLib();
    if (!lib) return null;
    const qr = lib(0, "M");
    qr.addData(String(text || ""));
    qr.make();
    const n = qr.getModuleCount();
    const rows = [];
    for (let r = 0; r < n; r += 1) {
      const row = [];
      for (let c = 0; c < n; c += 1) row.push(!!qr.isDark(r, c));
      rows.push(row);
    }
    return rows;
  }

  /* Muted gold on deep indigo. Modules meet at their edges, with rounded corners
   * and a quiet zone of four modules so the code still scans. */
  const QR_BG = [26, 21, 48, 255];
  const QR_FG = [230, 211, 164, 255];
  const QR_QUIET = 4;
  const QR_RADIUS = 0.3;

  function qrGeometry(rows) {
    const n = rows.length;
    const size = n + QR_QUIET * 2;
    const cells = [];
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (!rows[r][c]) continue;
        cells.push({
          x: c + QR_QUIET,
          y: r + QR_QUIET,
          w: 1,
          h: 1,
          rx: QR_RADIUS,
        });
      }
    }
    return { n: n, size: size, cells: cells };
  }

  function inRounded(px, py, cell) {
    const right = cell.x + cell.w;
    const bottom = cell.y + cell.h;
    if (px < cell.x || py < cell.y || px > right || py > bottom) return false;
    const r = cell.rx;
    let dx = 0;
    let dy = 0;
    if (px < cell.x + r) dx = cell.x + r - px;
    else if (px > right - r) dx = px - (right - r);
    if (py < cell.y + r) dy = cell.y + r - py;
    else if (py > bottom - r) dy = py - (bottom - r);
    return dx * dx + dy * dy <= r * r;
  }

  function qrElement(text) {
    const rows = qrMatrix(text);
    if (!rows || !root || !root.document) return null;
    const geom = qrGeometry(rows);
    const svg = root.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + geom.size + " " + geom.size);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "QR code for the practice link");
    const bg = root.document.createElementNS(svg.namespaceURI, "rect");
    bg.setAttribute("width", String(geom.size));
    bg.setAttribute("height", String(geom.size));
    bg.setAttribute("fill", "#1a1530");
    svg.append(bg);
    geom.cells.forEach((cell) => {
      const node = root.document.createElementNS(svg.namespaceURI, "rect");
      node.setAttribute("x", String(cell.x));
      node.setAttribute("y", String(cell.y));
      node.setAttribute("width", String(cell.w));
      node.setAttribute("height", String(cell.h));
      node.setAttribute("rx", String(cell.rx));
      node.setAttribute("ry", String(cell.rx));
      node.setAttribute("fill", "#e6d3a4");
      svg.append(node);
    });
    return svg;
  }

  /* The same geometry as the SVG, so a decoder can check the picture we draw. */
  function qrPixels(text, scale) {
    const rows = qrMatrix(text);
    if (!rows) return null;
    const step = Math.max(2, scale || 8);
    const geom = qrGeometry(rows);
    const width = geom.size * step;
    const height = width;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = QR_BG[0];
      data[i + 1] = QR_BG[1];
      data[i + 2] = QR_BG[2];
      data[i + 3] = 255;
    }
    const paint = (x, y) => {
      const o = (y * width + x) * 4;
      data[o] = QR_FG[0];
      data[o + 1] = QR_FG[1];
      data[o + 2] = QR_FG[2];
      data[o + 3] = 255;
    };
    geom.cells.forEach((cell) => {
      const x0 = Math.max(0, Math.floor(cell.x * step));
      const y0 = Math.max(0, Math.floor(cell.y * step));
      const x1 = Math.min(width, Math.ceil((cell.x + cell.w) * step));
      const y1 = Math.min(height, Math.ceil((cell.y + cell.h) * step));
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          if (inRounded((x + 0.5) / step, (y + 0.5) / step, cell)) paint(x, y);
        }
      }
    });
    return { width: width, height: height, data: data, quiet: QR_QUIET, scale: step, bg: QR_BG, fg: QR_FG };
  }

  function show(id, on) {
    const node = root && root.document ? root.document.getElementById(id) : null;
    if (node) node.hidden = !on;
  }

  function paint() {
    if (!root || !root.document) return;
    const box = root.document.getElementById("practice-link");
    if (!box || !root.YANTRA_WEB) return;
    box.hidden = false;
    const state = loadState();
    const on = !!(state.practiceKey && state.deviceId);
    const status = root.document.getElementById("practice-link-status");
    if (status) {
      status.textContent = on
        ? "Linked. Each device adds its own sits, and the days are shared."
        : "This device keeps its own practice.";
    }
    show("practice-link-start", !on);
    show("practice-link-share", on);
    show("practice-link-join", !on);
    show("practice-link-controls", on);
    const url = on ? linkFor(state.practiceKey) : "";
    const field = root.document.getElementById("practice-link-url");
    if (field && field.value !== url) field.value = url;
    if (!on) qrShown = false;
    const toggle = root.document.getElementById("practice-link-qr-show");
    if (toggle) {
      toggle.hidden = !on;
      toggle.textContent = qrShown ? "Hide the code" : "Show the code";
      toggle.setAttribute("aria-expanded", qrShown ? "true" : "false");
    }
    const qr = root.document.getElementById("practice-link-qr");
    if (qr) {
      if (!on || !qrShown) {
        qr.replaceChildren();
        qr.hidden = true;
        qrFor = "";
      } else if (qrFor !== url || !qr.firstChild) {
        const picture = qrElement(url);
        qr.replaceChildren(picture || root.document.createTextNode(""));
        qr.hidden = !picture;
        qrFor = picture ? url : "";
      } else {
        qr.hidden = false;
      }
    }
    const list = root.document.getElementById("practice-devices");
    if (list) {
      const active = root.document.activeElement;
      const editing = active && active.dataset && active.dataset.rename && list.contains(active);
      if (!editing) {
        if (!on) editingId = "";
        list.replaceChildren();
        devices().forEach((device) => {
          const row = root.document.createElement("li");
          row.append(deviceNameControl(device));
          if (!device.self) {
            const button = root.document.createElement("button");
            button.type = "button";
            button.className = "quiet";
            button.textContent = "Remove a device";
            button.addEventListener("click", () => askRemove(device));
            row.append(button);
          }
          list.append(row);
        });
        if (editingId) {
          const input = list.querySelector("[data-rename]");
          if (input) input.focus();
        }
      }
      list.hidden = !on;
    }
    const eraseCopy = root.document.getElementById("practice-erase-copy");
    if (eraseCopy) {
      eraseCopy.textContent = on
        ? "Erase your practice and settings on this device? Sits from other devices stay shared. Spotify stays. This cannot be undone."
        : "Erase your practice and settings on this device? Spotify stays. This cannot be undone.";
    }
    const note = root.document.getElementById("practice-link-note");
    if (note && root.document.activeElement !== note) note.textContent = noteText();
    const practiceNote = root.document.getElementById("practice-note");
    if (practiceNote && root.YantraPractice) practiceNote.textContent = ruleLine();
  }

  function deviceTitle(device) {
    if (device.name) return device.self ? device.name + " · this device" : device.name;
    return device.self ? "This device" : "A linked device";
  }

  function commitRename(input) {
    const id = (input && input.dataset && input.dataset.rename) || "";
    if (!id || editingId !== id) return;
    editingId = "";
    rename(id, input.value);
    paint();
    sync();
  }

  function deviceNameControl(device) {
    if (editingId === device.id) {
      const input = root.document.createElement("input");
      input.type = "text";
      input.maxLength = NAME_MAX;
      input.value = device.name || "";
      input.dataset.rename = device.id;
      input.setAttribute("aria-label", "Name for " + deviceTitle(device));
      input.autocomplete = "off";
      input.placeholder = "Name this device";
      input.addEventListener("blur", () => commitRename(input));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") {
          editingId = "";
          paint();
        }
      });
      return input;
    }
    const button = root.document.createElement("button");
    button.type = "button";
    button.className = "device-name";
    button.textContent = deviceTitle(device);
    button.setAttribute("aria-label", "Rename " + deviceTitle(device));
    button.addEventListener("click", () => {
      editingId = device.id;
      paint();
    });
    return button;
  }

  function askRemove(device) {
    removeId = device.id;
    const copy = root.document.getElementById("practice-remove-copy");
    const name = device.name || "that device";
    if (copy) copy.textContent = "Remove " + name + "? Its sits stay on it. If it still has the key, the next sync takes it out of the shared days.";
    show("practice-remove-confirm", true);
  }

  function bind() {
    const doc = root.document;
    const start = doc.getElementById("practice-link-start-btn");
    if (start) start.addEventListener("click", () => {
      linkNew();
      paint();
      sync();
    });
    const copy = doc.getElementById("practice-link-copy");
    if (copy) copy.addEventListener("click", () => {
      const url = (doc.getElementById("practice-link-url") || {}).value || "";
      const done = () => setNote("Link copied.");
      if (root.navigator && root.navigator.clipboard && url) {
        root.navigator.clipboard.writeText(url).then(done).catch(() => {
          const field = doc.getElementById("practice-link-url");
          if (field) { field.focus(); field.select(); }
          setNote("Select the link and copy it.");
        });
      } else done();
    });
    const qrShow = doc.getElementById("practice-link-qr-show");
    if (qrShow) qrShow.addEventListener("click", () => {
      qrShown = !qrShown;
      paint();
    });
    const joinBtn = doc.getElementById("practice-link-join-btn");
    if (joinBtn) joinBtn.addEventListener("click", () => {
      const input = doc.getElementById("practice-link-key");
      const result = join(input ? input.value : "");
      if (!result.ok) {
        setNote(result.error || "That key did not work.");
        return;
      }
      if (input) input.value = "";
      paint();
      sync().then(() => {
        if (root.showRoom) root.showRoom("account");
      });
    });
    const unlinkBtn = doc.getElementById("practice-unlink");
    if (unlinkBtn) unlinkBtn.addEventListener("click", () => show("practice-unlink-confirm", true));
    const unlinkKeep = doc.getElementById("practice-unlink-keep");
    if (unlinkKeep) unlinkKeep.addEventListener("click", () => show("practice-unlink-confirm", false));
    const unlinkYes = doc.getElementById("practice-unlink-yes");
    if (unlinkYes) unlinkYes.addEventListener("click", () => {
      show("practice-unlink-confirm", false);
      unlink().then(() => { if (root.paintPractice) root.paintPractice(); });
    });
    const forgetBtn = doc.getElementById("practice-forget");
    if (forgetBtn) forgetBtn.addEventListener("click", () => show("practice-forget-confirm", true));
    const forgetKeep = doc.getElementById("practice-forget-keep");
    if (forgetKeep) forgetKeep.addEventListener("click", () => show("practice-forget-confirm", false));
    const forgetYes = doc.getElementById("practice-forget-yes");
    if (forgetYes) forgetYes.addEventListener("click", () => {
      show("practice-forget-confirm", false);
      forget().then(() => { if (root.paintPractice) root.paintPractice(); });
    });
    const removeKeep = doc.getElementById("practice-remove-keep");
    if (removeKeep) removeKeep.addEventListener("click", () => { removeId = ""; show("practice-remove-confirm", false); });
    const removeYes = doc.getElementById("practice-remove-yes");
    if (removeYes) removeYes.addEventListener("click", () => {
      const id = removeId;
      removeId = "";
      show("practice-remove-confirm", false);
      if (id) removeDevice(id).then(() => { if (root.paintPractice) root.paintPractice(); });
    });
  }

  let openedFromLink = false;

  function consumeFragment() {
    if (!root || !root.location) return false;
    const hash = String(root.location.hash || "");
    if (hash.indexOf("link=") < 0) return false;
    const key = parseKey(hash);
    const strip = () => {
      try {
        const next = root.location.pathname + root.location.search;
        root.history.replaceState(null, "", next);
      } catch (e) {}
    };
    if (!key) {
      setNote("That link did not have a usable key.");
      strip();
      return false;
    }
    join(key);
    openedFromLink = true;
    root.yantraCameFromPracticeLink = true;
    strip();
    return true;
  }

  let bound = false;

  function boot() {
    if (!root || !root.document || !root.YANTRA_WEB) return;
    if (!root.document.getElementById("practice-link")) return;
    if (!bound) {
      bind();
      bound = true;
      root.document.addEventListener("visibilitychange", () => {
        if (root.document.visibilityState === "visible") sync();
        else if (loadState().pending) sync();
      });
      root.addEventListener("online", () => sync());
      root.addEventListener("pagehide", () => { if (loadState().pending) sync(); });
    }
    paint();
    const welcome = root.document.getElementById("welcome");
    if (openedFromLink && welcome && welcome.hidden && root.showRoom) root.showRoom("account");
    sync();
  }

  Practice.setView(viewOf);
  Practice.onCommit(() => {
    markPending();
    return sync();
  });
  Practice.onErase(() => {
    markPending();
    return sync();
  });

  if (root && root.document) {
    consumeFragment();
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  const api = {
    STATE_KEY: STATE_KEY,
    generatePracticeKey: generatePracticeKey,
    parseKey: parseKey,
    linkFor: linkFor,
    derive: derive,
    encrypt: encrypt,
    decrypt: decrypt,
    NAME_MAX: NAME_MAX,
    qrMatrix: qrMatrix,
    qrPixels: qrPixels,
    linkNew: linkNew,
    join: join,
    unlink: unlink,
    removeDevice: removeDevice,
    forget: forget,
    setName: setName,
    rename: rename,
    linked: linked,
    devices: devices,
    loadState: loadState,
    currentStore: currentStore,
    ruleLine: ruleLine,
    sync: sync,
    settled: settled,
    paint: paint,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.YantraSync = api;
    root.paintPracticeLink = paint;
  }
})(typeof window !== "undefined" ? window : null);
