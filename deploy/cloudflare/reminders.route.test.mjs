/* node deploy/cloudflare/reminders.route.test.mjs */
import assert from "assert";
import { deleteReminder, pushKey, saveReminder } from "./worker.js";

function kv(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, value); },
    async delete(key) { map.delete(key); },
  };
}

function post(body) {
  return new Request("https://yantramedi.app/push", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const env = {
  REMINDERS: kv(),
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "{}",
};
const id = "11111111-1111-4111-8111-111111111111";
const subscription = {
  endpoint: "https://push.example/device",
  keys: { p256dh: "p256dh-key-value", auth: "authsecret" },
};

const missing = await pushKey({});
assert.strictEqual(missing.status, 503);

const saved = await saveReminder(post({
  id,
  subscription,
  tz: "Pacific/Honolulu",
  lat: 21.3069,
  lon: -157.8583,
  morning: { on: true, mode: "sunrise", offset: -15, time: "06:30" },
  evening: { on: true, mode: "clock", offset: 0, time: "19:00" },
}), env);
assert.strictEqual(saved.status, 200);
const stored = JSON.parse(env.REMINDERS.map.get("sub:" + id));
assert.strictEqual(stored.lat, 21.3);
assert.strictEqual(stored.lon, -157.9);
assert.strictEqual(stored.morning.offset, -15);
assert.strictEqual(stored.subscription.endpoint, subscription.endpoint);
const index = JSON.parse(env.REMINDERS.map.get("index"));
assert.strictEqual(index.length, 1);
assert.strictEqual(index[0].id, id);
assert.ok(index[0].at > Date.now() - 3 * 60 * 1000);

const off = await saveReminder(post({
  id,
  subscription: null,
  tz: "Pacific/Honolulu",
  lat: 21.3069,
  lon: -157.8583,
  morning: { on: false, mode: "sunrise", offset: 0, time: "06:30" },
  evening: { on: false, mode: "clock", offset: 0, time: "19:00" },
}), env);
assert.strictEqual(off.status, 200);
assert.strictEqual(JSON.parse(env.REMINDERS.map.get("index")).length, 0);
assert.ok(JSON.parse(env.REMINDERS.map.get("sub:" + id)).subscription);

const removed = await deleteReminder(post({ id }), env);
assert.strictEqual(removed.status, 200);
assert.strictEqual(env.REMINDERS.map.has("sub:" + id), false);

const bad = await saveReminder(post({ id: "not-an-id", subscription, tz: "UTC", morning: { on: true, mode: "clock", time: "06:30" } }), env);
assert.strictEqual(bad.status, 400);

console.log("reminders.route.test.mjs ok");
