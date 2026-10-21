import { indexEntry, runReminders } from "./dispatch.js";
import { sendPush } from "./push.js";
import { sanitizeSchedule } from "../../web/schedule.js";

/* Sangha edition of Yantra on Cloudflare.
 *
 * The page, discs.json and web/ are static assets. Requests under /web/audio/
 * stream the sangha's mp3s from the private R2 bucket, with byte ranges so the
 * player can seek.
 *
 * No accounts: a listener types the sangha word once, and the phone keeps a
 * signed cookie for a year. SANGHA_WORD opens Vayu meditations only. ZAZEN_WORD,
 * given after the Rama talk, also opens Zazen and the lineage, plus Rama quotes
 * and Rama talk audio, and Lumikara. The Zazen data itself stays in the files. Both words and COOKIE_KEY are Worker secrets, kept
 * out of this public repo.
 */
const PREFIX = "/web/audio/";
const TALK_PREFIX = "/talks/";
const AMBIENT_PREFIX = "/ambient/";
// The Sangha word opens only Vayu. The Zazen word opens every circle:
// Vayu, Zazen, the lineage, and Lumikara.
const OPEN_CIRCLE = "vayu";
// Quote text, talk pages, and talk audio. A sangha cookie is refused these.
const RAMA_PATH = /^\/(?:talks(?:\/|$)|web\/talks(?:\/|$)|web\/talks\.json$|talks\.json$|web\/quotes\.json$|quotes\.json$)/;
const COOKIE = "yantra";
const YEAR = 365 * 24 * 3600;
const PUBLIC = /^\/(web\/manifest\.webmanifest|web\/icons\/[\w.-]+)$/;
// iOS asks the site root for these when a page, including the 401 gate, has no
// icon of its own. There is no favicon.ico on disk; the Sri Yantra png stands in.
const ROOT_ICON = {
  "/apple-touch-icon.png": "/web/icons/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png": "/web/icons/apple-touch-icon.png",
  "/favicon.ico": "/web/icons/icon-192.png",
};

/* Privacy and safety headers on every response: no referrer sent to other sites,
   no framing, no MIME sniffing, HTTPS pinned. The microphone is never allowed. */
const SAFETY = {
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "permissions-policy": "camera=(), geolocation=(self), payment=(), usb=(), microphone=(), autoplay=(self)",
  "cross-origin-opener-policy": "same-origin",
};

export default {
  async fetch(request, env) {
    const response = await route(request, env);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SAFETY)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runReminders(env, Date.now(), sendPush));
  },
};

export function ramaDenied(level, pathname) {
  if (level === "zazen") return false;
  return RAMA_PATH.test(pathname || "");
}

export function visibleShelf(data, level) {
  const zazen = level === "zazen";
  const discs = (data.discs || []).filter((disc) => zazen || disc.circle === OPEN_CIRCLE);
  const circles = (data.circles || []).filter((circle) => zazen || circle.id === OPEN_CIRCLE);
  return Object.assign({}, data, { discs, circles });
}

export async function route(request, env) {
  {
    const url = new URL(request.url);
    // One home address: www and the old workers.dev link both move to yantramedi.app.
    if (url.hostname === "www.yantramedi.app" || url.hostname.endsWith(".workers.dev")) {
      url.hostname = "yantramedi.app";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/") return Response.redirect(new URL("/web/", url), 302);
    if (url.pathname === "/enter" && request.method === "POST") return enter(request, env, url);
    if (url.pathname === "/logout" && (request.method === "GET" || request.method === "POST")) return logoutResponse();
    if (url.pathname === "/logout") return new Response("Method not allowed", { status: 405 });

    const icon = ROOT_ICON[url.pathname];
    if (icon && (request.method === "GET" || request.method === "HEAD")) {
      return env.ASSETS.fetch(new Request(new URL(icon, url), request));
    }

    // The app's name and icons load without cookies (browsers fetch the manifest
    // anonymously), and reveal nothing.
    if (PUBLIC.test(url.pathname)) return env.ASSETS.fetch(request);

    const level = await cookieLevel(request, env);
    if (!level) {
      const wantsPage = (request.headers.get("accept") || "").includes("text/html");
      return wantsPage ? gatePage("") : new Response("Enter the sangha word first.", { status: 401 });
    }
    if (ramaDenied(level, url.pathname)) {
      return new Response("This is for the Zazen word.", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
      });
    }
    if (url.pathname === "/access" && request.method === "GET") return accessResponse(level);
    if (url.pathname === "/access/sangha" && request.method === "POST") return downgradeResponse(env);
    if (url.pathname === "/leave" && request.method === "POST") return signOutResponse();
    if (url.pathname === "/access" || url.pathname === "/access/sangha" || url.pathname === "/leave") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/push/key" && request.method === "GET") return pushKey(env);
    if (url.pathname === "/push" && request.method === "POST") return saveReminder(request, env);
    if (url.pathname === "/push/delete" && request.method === "POST") return deleteReminder(request, env);
    if (url.pathname === "/push" || url.pathname === "/push/key" || url.pathname === "/push/delete") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/discs.json") return shelf(request, env, level);
    if (url.pathname === "/web/tracks.json" || url.pathname === "/web/audio.json") return trackLinks(request, env, level);
    if (url.pathname === "/web/quotes.json" || url.pathname === "/web/talks.json") return quotes(request, env);
    if (url.pathname.startsWith(AMBIENT_PREFIX)) return ambient(request, env, url);
    if (url.pathname.startsWith(TALK_PREFIX)) return talk(request, env, url);
    if (url.pathname.startsWith(PREFIX)) return recording(request, env, url, level);
    // The web loader fetches ../index.html. Assets would redirect that to "/", which
    // points back at the loader, so serve the page itself.
    if (url.pathname === "/index.html") return env.ASSETS.fetch(new Request(new URL("/", url), request));
    return env.ASSETS.fetch(request);
  }
}

/* ---- What each listener sees ---- */

async function loadDiscs(request, env) {
  return (await env.ASSETS.fetch(new Request(new URL("/discs.json", request.url)))).json();
}

async function hiddenDiscIds(request, env, level) {
  const data = await loadDiscs(request, env);
  const shown = new Set(visibleShelf(data, level).discs.map((disc) => disc.id));
  return new Set((data.discs || []).filter((disc) => !shown.has(disc.id)).map((disc) => disc.id));
}

function privateJson(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json", "cache-control": "private, no-store", vary: "cookie" },
  });
}

const ANON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function accessResponse(level) {
  return privateJson({ level: level === "zazen" ? "zazen" : "sangha" });
}

const CLEAR_COOKIE = `${COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;

/* The gate cookie is HttpOnly, so the page cannot drop it. Leave asks the Worker. */
export function signOutResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
      "set-cookie": CLEAR_COOKIE,
    },
  });
}

/* A real navigation, so iOS standalone replaces the app with the word prompt.
   The status is 200: a home-screen app will not show a 401 body, so Log out
   would clear the cookie and leave Stephen on the account page. */
export function logoutResponse() {
  const page = gatePage("");
  const headers = new Headers(page.headers);
  headers.set("set-cookie", CLEAR_COOKIE);
  headers.set("cache-control", "no-store");
  return new Response(page.body, { status: 200, headers });
}

/* Drop Zazen privilege without asking for a word, and without storing one. */
export async function downgradeResponse(env) {
  if (!env || !env.COOKIE_KEY) return privateJson({ error: "The word gate is not open in this copy." }, 503);
  const exp = Math.floor(Date.now() / 1000) + YEAR;
  const value = `sangha.${exp}.${await hmac(env, "sangha." + exp)}`;
  return new Response(JSON.stringify({ ok: true, level: "sangha" }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
      "set-cookie": `${COOKIE}=${value}; Max-Age=${YEAR}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    },
  });
}

function remindersUnavailable() {
  return privateJson({ error: "Reminders are not turned on for this site yet. The times stay on this device." }, 503);
}

export async function pushKey(env) {
  if (!env.REMINDERS || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return remindersUnavailable();
  return privateJson({ publicKey: env.VAPID_PUBLIC_KEY });
}

async function readReminderBody(request) {
  const text = await request.text();
  if (text.length > 8000) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? data : null;
  } catch (e) {
    return null;
  }
}

function cleanSubscription(raw) {
  if (!raw || typeof raw !== "object") return null;
  const endpoint = raw.endpoint;
  const keys = raw.keys || {};
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 2000) return null;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length < 8 || keys.p256dh.length > 200 || keys.auth.length < 4 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

async function readIndex(env) {
  try {
    const parsed = JSON.parse(await env.REMINDERS.get("index") || "[]");
    return Array.isArray(parsed) ? parsed.filter((row) => row && row.id) : [];
  } catch (e) {
    return [];
  }
}

async function writeIndexRow(env, id, entry) {
  const index = (await readIndex(env)).filter((row) => row.id !== id);
  if (entry && entry.at) index.push({ id, at: entry.at });
  await env.REMINDERS.put("index", JSON.stringify(index));
}

async function loadReminder(env, id) {
  try {
    const parsed = JSON.parse(await env.REMINDERS.get("sub:" + id) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

export async function saveReminder(request, env) {
  if (!env.REMINDERS || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return remindersUnavailable();
  const body = await readReminderBody(request);
  if (!body || !ANON.test(body.id || "")) return privateJson({ error: "The reminder could not be saved." }, 400);
  const schedule = sanitizeSchedule(body);
  const subscription = cleanSubscription(body.subscription);
  const existing = await loadReminder(env, body.id);
  const record = Object.assign({}, schedule, {
    subscription: subscription || (existing && existing.subscription) || null,
    sent: (existing && existing.sent) || {},
  });
  const wants = record.morning.on || record.evening.on;
  if (wants && !record.subscription) return privateJson({ error: "The reminder could not be saved." }, 400);
  await env.REMINDERS.put("sub:" + body.id, JSON.stringify(record));
  const entry = wants ? indexEntry(body.id, record, Date.now()) : null;
  await writeIndexRow(env, body.id, entry);
  return privateJson({ ok: true });
}

export async function deleteReminder(request, env) {
  if (!env.REMINDERS) return privateJson({ ok: true });
  const body = await readReminderBody(request);
  if (!body || !ANON.test(body.id || "")) return privateJson({ error: "The reminder data could not be deleted." }, 400);
  await env.REMINDERS.delete("sub:" + body.id);
  await writeIndexRow(env, body.id, null);
  return privateJson({ ok: true });
}

async function shelf(request, env, level) {
  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;
  return privateJson(visibleShelf(await response.json(), level));
}

// Song links and the recordings list are both keyed by disc, so both lose the gated discs.
async function trackLinks(request, env, level) {
  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;
  const data = await response.json();
  for (const id of await hiddenDiscIds(request, env, level)) delete data[id];
  return privateJson(data);
}

async function quotes(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json");
  headers.set("cache-control", "private, no-store");
  headers.set("vary", "cookie");
  return new Response(request.method === "HEAD" ? null : response.body, { status: 200, headers });
}

function streamObject(request, object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=86400");
  if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
  if (!("body" in object)) return new Response(null, { status: 304, headers });
  if (object.range && request.headers.has("range")) {
    const start = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - start;
    headers.set("content-range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(request.method === "HEAD" ? null : object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

async function recording(request, env, url, level) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const key = decodeURIComponent(url.pathname.slice(PREFIX.length));
  if (!/^[a-z0-9-]+\/\d{2}\.mp3$/.test(key)) return new Response("Not found", { status: 404 });
  // A recording outside the listener's circles is refused, not just unlisted.
  if ((await hiddenDiscIds(request, env, level)).has(key.split("/")[0])) {
    return new Response("This is for the Zazen word.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  const object = await env.AUDIO.get(key, { range: request.headers, onlyIf: request.headers });
  if (object === null) return new Response("Not found", { status: 404 });
  return streamObject(request, object);
}

async function ambient(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const name = decodeURIComponent(url.pathname.slice(AMBIENT_PREFIX.length));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.mp3$/.test(name)) return new Response("Not found", { status: 404 });
  const object = await env.AUDIO.get("ambient/" + name, { range: request.headers, onlyIf: request.headers });
  if (object === null) return new Response("Not found", { status: 404 });
  return streamObject(request, object);
}

async function talk(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const key = "talks/" + decodeURIComponent(url.pathname.slice(TALK_PREFIX.length));
  if (!/^talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/.test(key) || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.AUDIO.get(key, { range: request.headers, onlyIf: request.headers });
  if (object === null) return new Response("Not found", { status: 404 });
  return streamObject(request, object);
}

/* ---- The sangha word ---- */

async function hmac(env, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.COOKIE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintCookie(env, level, now = Date.now()) {
  const exp = Math.floor(now / 1000) + YEAR;
  return `${level}.${exp}.${await hmac(env, level + "." + exp)}`;
}

export async function cookieLevel(request, env) {
  if (!env.COOKIE_KEY) return "";
  const match = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!match) return "";
  const [level, exp, sig] = match[1].split(".");
  if (!["sangha", "zazen"].includes(level) || !(Number(exp) * 1000 > Date.now())) return "";
  return same(sig || "", await hmac(env, level + "." + exp)) ? level : "";
}

function norm(word) {
  return String(word || "").trim().toLowerCase();
}

async function enter(request, env, url) {
  const form = await request.formData().catch(() => null);
  const word = norm(form && form.get("word"));
  let level = "";
  if (word && env.ZAZEN_WORD && same(word, norm(env.ZAZEN_WORD))) level = "zazen";
  else if (word && env.SANGHA_WORD && same(word, norm(env.SANGHA_WORD))) level = "sangha";
  if (!level || !env.COOKIE_KEY) {
    await new Promise((r) => setTimeout(r, 800));
    return gatePage("That word doesn't open it. Ask Chitananda for the sangha word.");
  }
  const value = await mintCookie(env, level);
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/web/", url).toString(),
      "set-cookie": `${COOKIE}=${value}; Max-Age=${YEAR}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    },
  });
}

function gatePage(note) {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#05040a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Yantra">
<link rel="manifest" href="/web/manifest.webmanifest">
<link rel="icon" href="/web/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/web/icons/apple-touch-icon.png" sizes="180x180">
<title>Yantra Meditation</title>
<style>
  html, body { margin: 0; height: 100%; background: #05040a; color: #f3e6c8; }
  body { display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;
         font-family: Palatino, "Iowan Old Style", "Times New Roman", serif;
         background: radial-gradient(ellipse at center, #120e1c, #05040a 70%); }
  form { width: min(22rem, 100%); display: flex; flex-direction: column; gap: 1rem; text-align: center; }
  h1 { font-weight: 500; font-size: clamp(2rem, 8vw, 2.8rem); margin: 0 0 1.4rem; color: #f7edd4; }
  input { font: inherit; font-size: 1.15rem; text-align: center; padding: 0.9rem; background: rgba(5, 4, 10, 0.6);
          color: #f7edd4; border: 1px solid rgba(230, 201, 138, 0.45); border-radius: 0; }
  input::placeholder { color: rgba(232, 204, 146, 0.45); }
  button { font: inherit; font-size: 1.1rem; letter-spacing: 0.08em; padding: 0.95rem; cursor: pointer;
           background: transparent; color: #f7edd4; border: 1px solid rgba(230, 201, 138, 0.8); }
  p { min-height: 1.4rem; margin: 0; color: rgba(232, 204, 146, 0.8); font-size: 0.95rem; line-height: 1.5; }
</style></head><body>
<form method="post" action="/enter">
  <h1>Yantra Meditation</h1>
  <input name="word" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Sangha word" required autofocus>
  <button type="submit">Enter</button>
  <p>${note}</p>
</form></body></html>`;
  // 401 keeps the service worker from caching this page in place of the app.
  return new Response(html, { status: 401, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
