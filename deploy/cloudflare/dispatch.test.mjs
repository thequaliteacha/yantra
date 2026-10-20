/* node deploy/cloudflare/dispatch.test.mjs */
import assert from "assert";
import { indexEntry, runReminders } from "./dispatch.js";
import { fireAt, sanitizeSchedule } from "../../web/schedule.js";

function kv(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, value); },
    async delete(key) { map.delete(key); },
  };
}

const record = sanitizeSchedule({
  tz: "America/Chicago",
  lat: 30.3,
  lon: -97.7,
  morning: { on: true, mode: "clock", offset: 0, time: "06:30" },
  evening: { on: true, mode: "clock", offset: 0, time: "19:00" },
});
record.subscription = { endpoint: "https://push.example/1", keys: { p256dh: "aa", auth: "bb" } };
record.sent = {};
const morningAt = fireAt(record, "morning", "2026-06-21");
const eveningAt = fireAt(record, "evening", "2026-06-21");
const store = kv({
  index: JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", at: morningAt }]),
  "sub:11111111-1111-4111-8111-111111111111": JSON.stringify(record),
});
const calls = [];
const env = { REMINDERS: store, VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "{}" };
const result = await runReminders(env, morningAt + 20 * 1000, async (given, sub, note) => {
  calls.push(note);
  assert.strictEqual(given, env);
  assert.strictEqual(sub.endpoint, record.subscription.endpoint);
  return 201;
});
assert.strictEqual(result.sent, 1);
assert.strictEqual(calls[0].theme, "morning");
assert.ok(calls[0].body.includes("morning light"));
assert.strictEqual(calls[0].url, "/web/?ready=morning");
const saved = JSON.parse(store.map.get("sub:11111111-1111-4111-8111-111111111111"));
assert.strictEqual(saved.sent.morning, "2026-06-21");
const index = JSON.parse(store.map.get("index"));
assert.strictEqual(index[0].at, eveningAt);

const again = await runReminders(env, morningAt + 40 * 1000, async () => {
  throw new Error("should not send twice");
});
assert.strictEqual(again.sent, 0);

store.map.set("index", JSON.stringify([{ id: "gone", at: morningAt }]));
store.map.delete("sub:gone");
const missing = await runReminders(env, morningAt + 1000, async () => 201);
assert.strictEqual(missing.removed, 1);
assert.deepStrictEqual(JSON.parse(store.map.get("index")).filter((row) => row.id === "gone"), []);

const stale = { ...record, subscription: { endpoint: "https://push.example/old", keys: { p256dh: "a", auth: "b" } } };
store.map.set("sub:stale", JSON.stringify(stale));
store.map.set("index", JSON.stringify([indexEntry("stale", stale, morningAt - 1000)]));
const dropped = await runReminders(env, morningAt + 1000, async () => 410);
assert.strictEqual(dropped.removed, 1);
assert.strictEqual(store.map.has("sub:stale"), false);

console.log("dispatch.test.mjs ok");
