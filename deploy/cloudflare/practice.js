/* Encrypted practice blobs. The Worker never sees the practice key or the days.
   Callers behind the word gate pass a lookup id and a device id. What is stored
   is ciphertext. Nothing here is written to a log.
 */
export const PRACTICE_MAX_BYTES = 512 * 1024;
export const PRACTICE_MAX_DEVICES = 8;
export const PRACTICE_RATE_LIMIT = 60;
const WINDOW_MS = 60 * 1000;
const LOOKUP_ID = /^[0-9a-f]{64}$/;
const DEVICE_ID = /^[0-9a-f]{32}$/;
const PATH = /^\/api\/practice\/([0-9a-f]{64})(?:\/([0-9a-f]{32}))?$/;

function json(data, status, extra) {
  const headers = {
    "content-type": "application/json",
    "cache-control": "private, no-store",
    vary: "cookie",
  };
  if (extra) Object.assign(headers, extra);
  return new Response(JSON.stringify(data), { status: status || 200, headers });
}

function deviceKey(lookupId, deviceId) {
  return "practice:d:" + lookupId + ":" + deviceId;
}

function goneKey(lookupId) {
  return "practice:gone:" + lookupId;
}

function blockKey(lookupId, deviceId) {
  return "practice:block:" + lookupId + ":" + deviceId;
}

function rateKey(lookupId) {
  return "practice:rl:" + lookupId;
}

function decodeB64url(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]+$/.test(text) || text.length > PRACTICE_MAX_BYTES) return null;
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i) & 255;
    return out;
  } catch (e) {
    return null;
  }
}

async function readCapped(request, max) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > max) return { error: "size" };
  if (!request.body || !request.body.getReader) {
    const text = await request.text();
    if (text.length > max) return { error: "size" };
    return { text };
  }
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    size += step.value.byteLength;
    if (size > max) {
      try { await reader.cancel(); } catch (e) {}
      return { error: "size" };
    }
    parts.push(step.value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (let i = 0; i < parts.length; i += 1) {
    all.set(parts[i], offset);
    offset += parts[i].byteLength;
  }
  return { text: new TextDecoder().decode(all) };
}

async function allowed(env, lookupId, now) {
  const key = rateKey(lookupId);
  const t = now || Date.now();
  try {
    let row = { t: t, n: 0 };
    const parsed = JSON.parse(await env.REMINDERS.get(key) || "null");
    if (parsed && typeof parsed.n === "number" && t - Number(parsed.t) < WINDOW_MS) {
      row = { t: Number(parsed.t), n: parsed.n };
    }
    row.n += 1;
    await env.REMINDERS.put(key, JSON.stringify({ t: row.t, n: row.n }), { expirationTtl: 120 });
    return row.n <= PRACTICE_RATE_LIMIT;
  } catch (e) {
    return true;
  }
}

async function isGone(env, lookupId) {
  const value = await env.REMINDERS.get(goneKey(lookupId));
  return value != null && value !== "";
}

async function isBlocked(env, lookupId, deviceId) {
  const value = await env.REMINDERS.get(blockKey(lookupId, deviceId));
  return value != null && value !== "";
}

async function listIds(env, lookupId) {
  const prefix = "practice:d:" + lookupId + ":";
  const ids = [];
  let cursor = "";
  for (let page = 0; page < 8; page += 1) {
    const listed = await env.REMINDERS.list(cursor ? { prefix: prefix, cursor: cursor } : { prefix: prefix });
    const keys = listed && Array.isArray(listed.keys) ? listed.keys : [];
    keys.forEach((row) => {
      const name = row && row.name ? String(row.name) : "";
      const id = name.startsWith(prefix) ? name.slice(prefix.length) : "";
      if (DEVICE_ID.test(id) && ids.indexOf(id) < 0) ids.push(id);
    });
    if (!listed || listed.list_complete !== false || !listed.cursor) break;
    cursor = listed.cursor;
  }
  return ids;
}

async function readBlob(env, lookupId, deviceId) {
  const text = await env.REMINDERS.get(deviceKey(lookupId, deviceId));
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.iv !== "string" || typeof parsed.ct !== "string") return null;
    return { id: deviceId, iv: parsed.iv, ct: parsed.ct, at: Number(parsed.at) || 0 };
  } catch (e) {
    return null;
  }
}

function parsePath(pathname) {
  if (pathname !== "/api/practice" && !pathname.startsWith("/api/practice/")) return null;
  const match = PATH.exec(pathname);
  if (!match) return { bad: true };
  return { lookupId: match[1], deviceId: match[2] || "" };
}

async function readEnvelope(request) {
  const read = await readCapped(request, PRACTICE_MAX_BYTES);
  if (read.error) return { error: "size" };
  let body = null;
  try { body = JSON.parse(read.text || ""); } catch (e) { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "bad" };
  const iv = decodeB64url(body.iv);
  const ct = decodeB64url(body.ct);
  if (!iv || iv.length !== 12 || !ct || ct.length < 16) return { error: "bad" };
  return { iv: body.iv, ct: body.ct };
}

export async function practiceRoute(request, env) {
  const url = new URL(request.url);
  const parsed = parsePath(url.pathname);
  if (!parsed || parsed.bad) return json({ error: "The practice address was not understood." }, 400);
  const method = request.method;
  const lookupId = parsed.lookupId;
  const deviceId = parsed.deviceId;
  if (!LOOKUP_ID.test(lookupId) || (deviceId && !DEVICE_ID.test(deviceId))) {
    return json({ error: "The practice address was not understood." }, 400);
  }
  if (!env || !env.REMINDERS || typeof env.REMINDERS.get !== "function") {
    return json({ error: "Practice sync is not turned on for this site yet. Your sits stay on this device." }, 503);
  }
  if (!(await allowed(env, lookupId))) return json({ error: "Too many tries just now." }, 429);

  const gone = await isGone(env, lookupId);
  if (gone && method !== "DELETE") return json({ error: "This practice key was forgotten." }, 410);

  if (method === "GET" && !deviceId) {
    const ids = await listIds(env, lookupId);
    const devices = [];
    for (let i = 0; i < ids.length; i += 1) {
      const blob = await readBlob(env, lookupId, ids[i]);
      if (blob) devices.push(blob);
    }
    return json({ devices: devices });
  }

  if (method === "GET" && deviceId) {
    const blob = await readBlob(env, lookupId, deviceId);
    if (!blob) return json({ error: "No record for that device." }, 404);
    return json(blob);
  }

  if (method === "PUT" && deviceId) {
    if (await isBlocked(env, lookupId, deviceId)) {
      return json({ error: "This device was removed from the practice." }, 403);
    }
    const envelope = await readEnvelope(request);
    if (envelope.error === "size") return json({ error: "The practice record is too large." }, 413);
    if (envelope.error) return json({ error: "The practice record could not be saved." }, 400);
    const ids = await listIds(env, lookupId);
    if (ids.indexOf(deviceId) < 0 && ids.length >= PRACTICE_MAX_DEVICES) {
      return json({ error: "This practice already has as many devices as it can hold." }, 409);
    }
    const record = { iv: envelope.iv, ct: envelope.ct, at: Date.now() };
    await env.REMINDERS.put(deviceKey(lookupId, deviceId), JSON.stringify(record));
    return json({ ok: true });
  }

  if (method === "PUT") return json({ error: "A device is needed." }, 400);

  if (method === "DELETE" && deviceId) {
    await env.REMINDERS.put(blockKey(lookupId, deviceId), "1");
    await env.REMINDERS.delete(deviceKey(lookupId, deviceId));
    return json({ ok: true });
  }

  if (method === "DELETE") {
    await env.REMINDERS.put(goneKey(lookupId), "1");
    const ids = await listIds(env, lookupId);
    for (let i = 0; i < ids.length; i += 1) await env.REMINDERS.delete(deviceKey(lookupId, ids[i]));
    return json({ ok: true });
  }

  const allow = deviceId ? "GET, PUT, DELETE" : "GET, DELETE";
  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: allow, "cache-control": "private, no-store" },
  });
}
