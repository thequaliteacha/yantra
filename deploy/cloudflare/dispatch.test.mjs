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

const lateStore = kv({
  index: JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", at: morningAt }]),
  "sub:11111111-1111-4111-8111-111111111111": JSON.stringify({ ...record, sent: {} }),
});
let lateSends = 0;
const late = await runReminders({ REMINDERS: lateStore }, morningAt + 5 * 60 * 1000, async () => {
  lateSends += 1;
  return 201;
});
assert.strictEqual(late.sent, 1, "five minutes late still sends");
assert.strictEqual(lateSends, 1);

const missedStore = kv({
  index: JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", at: morningAt }]),
  "sub:11111111-1111-4111-8111-111111111111": JSON.stringify({ ...record, sent: {} }),
});
let missedSends = 0;
const missed = await runReminders({ REMINDERS: missedStore }, morningAt + 30 * 60 * 1000, async () => {
  missedSends += 1;
  return 201;
});
assert.strictEqual(missed.sent, 0, "past the window it does not send a stale note");
assert.strictEqual(missedSends, 0);
assert.strictEqual(missed.rescheduled, 1);
const moved = JSON.parse(missedStore.map.get("index"));
assert.strictEqual(moved[0].at, eveningAt, "a missed morning still leaves the evening in place");

const retryStore = kv({
  index: JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", at: morningAt }]),
  "sub:11111111-1111-4111-8111-111111111111": JSON.stringify({ ...record, sent: {} }),
});
const failed = await runReminders({ REMINDERS: retryStore }, morningAt + 1000, async () => 503);
assert.strictEqual(failed.sent, 0);
assert.strictEqual(failed.failed, 1);
assert.strictEqual(JSON.parse(retryStore.map.get("index"))[0].at, morningAt, "a failed send stays on this note");

console.log("dispatch.test.mjs ok");
