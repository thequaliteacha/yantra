/* node deploy/cloudflare/practice.route.test.mjs */
import assert from "assert";
import { mintCookie, route } from "./worker.js";
import { PRACTICE_MAX_BYTES, PRACTICE_MAX_DEVICES, PRACTICE_RATE_LIMIT, practiceRoute } from "./practice.js";

function kv() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, String(value)); },
    async delete(key) { map.delete(key); },
    async list(options) {
      const prefix = (options && options.prefix) || "";
      const keys = [];
      for (const name of map.keys()) {
        if (!prefix || name.startsWith(prefix)) keys.push({ name });
      }
      return { keys, list_complete: true, cursor: "" };
    },
  };
}

function lookup(n) {
  return n.toString(16).padStart(64, "a");
}

function device(n) {
  return n.toString(16).padStart(32, "b");
}

function envelope(mark) {
  const iv = Buffer.alloc(12, mark);
  const ct = Buffer.alloc(24, mark + 1);
  return { iv: iv.toString("base64url"), ct: ct.toString("base64url") };
}

function call(method, path, body, headers) {
  return new Request("https://yantramedi.app" + path, {
    method,
    headers: headers || { "content-type": "application/json" },
    body: body == null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

const env = { REMINDERS: kv() };
const gate = {
  COOKIE_KEY: "test-cookie-key",
  SANGHA_WORD: "sangha-word",
  ZAZEN_WORD: "zazen-word",
  REMINDERS: env.REMINDERS,
  ASSETS: { async fetch() { return new Response("missing", { status: 404 }); } },
};

const logs = [];
const originals = ["log", "info", "debug", "warn", "error"].map((name) => {
  const original = console[name].bind(console);
  console[name] = (...args) => { logs.push(name + " " + args.join(" ")); };
  return { name, original };
});

const id = lookup(1);
const first = device(1);
const second = device(2);
const blob = envelope(3);
const put = await practiceRoute(call("PUT", "/api/practice/" + id + "/" + first, Object.assign({
  practiceKey: "super-secret-practice-key",
  days: { morning: 1 },
  name: "iPad",
}, blob)), env);
assert.strictEqual(put.status, 200);
assert.deepStrictEqual(await put.json(), { ok: true });
const storedKey = "practice:d:" + id + ":" + first;
const stored = JSON.parse(env.REMINDERS.map.get(storedKey));
assert.deepStrictEqual(Object.keys(stored).sort(), ["at", "ct", "iv"]);
assert.strictEqual(stored.iv, blob.iv);
assert.strictEqual(stored.ct, blob.ct);
assert.ok(stored.at > 0);
const storedText = env.REMINDERS.map.get(storedKey);
assert.strictEqual(storedText.includes("super-secret-practice-key"), false);
assert.strictEqual(storedText.includes("morning"), false);
assert.strictEqual(storedText.includes("iPad"), false);

const one = await practiceRoute(call("GET", "/api/practice/" + id + "/" + first), env);
assert.strictEqual(one.status, 200);
assert.strictEqual(one.headers.get("cache-control"), "private, no-store");
const oneBody = await one.json();
assert.strictEqual(oneBody.id, first);
assert.strictEqual(oneBody.ct, blob.ct);

const other = envelope(9);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + id + "/" + second, other), env)).status, 200);
const listed = await (await practiceRoute(call("GET", "/api/practice/" + id), env)).json();
assert.strictEqual(listed.devices.length, 2);
assert.ok(listed.devices.every((row) => row.iv && row.ct && !row.days && !row.name));

const replaced = envelope(4);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + id + "/" + first, replaced), env)).status, 200);
const after = await (await practiceRoute(call("GET", "/api/practice/" + id), env)).json();
assert.strictEqual(after.devices.length, 2, "putting the same device again does not add a second copy");
assert.strictEqual(after.devices.find((row) => row.id === first).ct, replaced.ct);

assert.strictEqual((await practiceRoute(call("DELETE", "/api/practice/" + id + "/" + second), env)).status, 200);
const remaining = await (await practiceRoute(call("GET", "/api/practice/" + id), env)).json();
assert.deepStrictEqual(remaining.devices.map((row) => row.id), [first]);
assert.strictEqual((await practiceRoute(call("GET", "/api/practice/" + id + "/" + second), env)).status, 404);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + id + "/" + second, other), env)).status, 403);
assert.strictEqual(env.REMINDERS.map.has("practice:d:" + id + ":" + second), false);
assert.strictEqual((await practiceRoute(call("DELETE", "/api/practice/" + id + "/" + second), env)).status, 200);

assert.strictEqual((await practiceRoute(call("DELETE", "/api/practice/" + id), env)).status, 200);
assert.strictEqual(env.REMINDERS.map.has(storedKey), false);
assert.strictEqual(env.REMINDERS.map.get("practice:gone:" + id), "1");
assert.strictEqual((await practiceRoute(call("GET", "/api/practice/" + id), env)).status, 410);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + id + "/" + first, blob), env)).status, 410);
assert.strictEqual(env.REMINDERS.map.has(storedKey), false, "a forgotten key does not accept a new blob");

const fresh = lookup(2);
assert.strictEqual((await practiceRoute(call("GET", "/api/practice/" + fresh), env)).status, 200);
assert.deepStrictEqual(await (await practiceRoute(call("GET", "/api/practice/" + fresh), env)).json(), { devices: [] });

assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + fresh + "/" + first, { iv: "aa", ct: blob.ct }), env)).status, 400);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + fresh + "/" + first, "{"), env)).status, 400);
assert.strictEqual((await practiceRoute(call("POST", "/api/practice/" + fresh + "/" + first, blob), env)).status, 405);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/zz/" + first, blob), env)).status, 400);
assert.strictEqual((await practiceRoute(call("GET", "/api/practice/" + fresh + "/not-a-device"), env)).status, 400);

const capped = lookup(3);
for (let n = 1; n <= PRACTICE_MAX_DEVICES; n += 1) {
  const status = (await practiceRoute(call("PUT", "/api/practice/" + capped + "/" + device(n), envelope(n)), env)).status;
  assert.strictEqual(status, 200, "device " + n);
}
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + capped + "/" + device(PRACTICE_MAX_DEVICES + 1), envelope(1)), env)).status, 409);
assert.strictEqual((await (await practiceRoute(call("GET", "/api/practice/" + capped), env)).json()).devices.length, PRACTICE_MAX_DEVICES);

const heavy = lookup(4);
const tooBig = "x".repeat(PRACTICE_MAX_BYTES + 1);
assert.strictEqual((await practiceRoute(call("PUT", "/api/practice/" + heavy + "/" + first, tooBig, { "content-type": "application/json", "content-length": String(tooBig.length) }), env)).status, 413);
assert.strictEqual(env.REMINDERS.map.has("practice:d:" + heavy + ":" + first), false);

const limited = lookup(5);
let limitedStatus = 200;
for (let n = 0; n < PRACTICE_RATE_LIMIT + 5 && limitedStatus !== 429; n += 1) {
  limitedStatus = (await practiceRoute(call("GET", "/api/practice/" + limited), env)).status;
}
assert.strictEqual(limitedStatus, 429);
assert.strictEqual((await practiceRoute(call("GET", "/api/practice/" + lookup(6)), env)).status, 200, "the limit is per practice");
const rateRecord = env.REMINDERS.map.get("practice:rl:" + limited);
assert.ok(rateRecord);
assert.strictEqual(rateRecord.includes(blob.ct), false);

const quiet = lookup(7);
await practiceRoute(call("PUT", "/api/practice/" + quiet + "/" + first, blob), env);
await practiceRoute(call("GET", "/api/practice/" + quiet), env);
originals.forEach((entry) => { console[entry.name] = entry.original; });
assert.deepStrictEqual(logs, []);

assert.strictEqual((await practiceRoute(call("GET", "/api/practice/" + lookup(8)), {})).status, 503);

const sangha = await mintCookie(gate, "sangha");
const closed = await route(new Request("https://yantramedi.app/api/practice/" + lookup(9), { method: "PUT", body: JSON.stringify(blob) }), gate);
assert.strictEqual(closed.status, 401);
assert.strictEqual(gate.REMINDERS.map.has("practice:d:" + lookup(9) + ":" + first), false);

const opened = await route(new Request("https://yantramedi.app/api/practice/" + lookup(9) + "/" + first, {
  method: "PUT",
  headers: { cookie: "yantra=" + sangha, "content-type": "application/json" },
  body: JSON.stringify(blob),
}), gate);
assert.strictEqual(opened.status, 200);
const listedThroughGate = await route(new Request("https://yantramedi.app/api/practice/" + lookup(9), {
  headers: { cookie: "yantra=" + sangha },
}), gate);
assert.strictEqual(listedThroughGate.status, 200);
assert.strictEqual((await listedThroughGate.json()).devices.length, 1);
assert.strictEqual(listedThroughGate.headers.get("cache-control"), "private, no-store");

const zazen = await mintCookie(gate, "zazen");
const zazenGet = await route(new Request("https://yantramedi.app/api/practice/" + lookup(9) + "/" + first, {
  headers: { cookie: "yantra=" + zazen },
}), gate);
assert.strictEqual(zazenGet.status, 200);

console.log("practice.route.test.mjs ok");
