/* node web/settings.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const S = require("./settings.js");

function mem(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

assert.strictEqual(S.get("account.preferredMethod", mem()), "telegram");
assert.strictEqual(S.get("flags.accountSync", mem()), false);
assert.deepStrictEqual(S.get("talks.saved", mem()), []);
assert.strictEqual(S.get("glow.level", mem()), null);

const store = mem();
const seen = [];
const stop = S.subscribe((key, value) => seen.push([key, value]));
assert.strictEqual(S.set("profile.name", "  Ada   Lovelace ", store), "Ada Lovelace");
assert.strictEqual(S.get("profile.name", store), "Ada Lovelace");
const raw = JSON.parse(store.getItem(S.KEY));
assert.strictEqual(raw["profile.name"].value, "Ada Lovelace");
assert.ok(raw["profile.name"].updatedAt > 0);
assert.deepStrictEqual(seen, [["profile.name", "Ada Lovelace"]]);
stop();
S.set("profile.name", "Bea", store);
assert.deepStrictEqual(seen, [["profile.name", "Ada Lovelace"]]);

S.set("talks.saved", ["balance", "balance", "no spaces", "enlightenment-cycle"], store);
assert.deepStrictEqual(S.get("talks.saved", store), ["balance", "enlightenment-cycle"]);
S.set("flags.accountSync", false, store);
assert.strictEqual(S.get("flags.accountSync", store), false);
S.set("account.preferredMethod", "Telegram", store);
assert.strictEqual(S.get("account.preferredMethod", store), "telegram");

const legacy = mem({
  "yantra.profile.v1": JSON.stringify({ name: "Rama Student", greeting: "time" }),
  "yantra.reminders.v1": JSON.stringify({ id: "abc", morning: { on: true } }),
  "yantra.glow": JSON.stringify({ level: 80, light: true }),
  "yantra.practice.v1": JSON.stringify({ days: { "2026-10-20": true } }),
  "yantra.spotify": "{}",
});
S.migrate(legacy);
assert.strictEqual(legacy.getItem("yantra.profile.v1"), null);
assert.strictEqual(legacy.getItem("yantra.reminders.v1"), null);
assert.strictEqual(legacy.getItem("yantra.glow"), null);
assert.ok(legacy.getItem("yantra.practice.v1"));
assert.strictEqual(legacy.getItem("yantra.spotify"), "{}");
assert.strictEqual(S.get("profile.name", legacy), "Rama Student");
assert.strictEqual(S.get("profile.greeting", legacy), "time");
assert.strictEqual(S.get("reminders", legacy).id, "abc");
assert.strictEqual(S.get("glow.level", legacy), 80);
assert.strictEqual(S.get("theme.light", legacy), true);

const packed = S.entries(legacy);
assert.strictEqual(packed["talks.saved"].value.length, 0);
assert.strictEqual(packed["account.preferredMethod"].value, "telegram");
assert.strictEqual(packed["profile.name"].value, "Rama Student");
assert.ok(packed["talks.saved"].updatedAt === null);

S.erase(legacy);
assert.strictEqual(legacy.getItem(S.KEY), null);
assert.ok(legacy.getItem("yantra.practice.v1"));
assert.strictEqual(legacy.getItem("yantra.spotify"), "{}");

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/worker.js"), "utf8");
assert.ok(page.includes("Leave Yantra on this device"));
assert.ok(page.includes('action="/logout"'));
assert.ok(page.includes('id="account-sync"'));
assert.ok(page.includes('id="account-corner"'));
assert.ok(page.includes('id="account-zazen"'));
assert.ok(page.includes('id="account-talks"'));
assert.ok(account.includes("flags.accountSync"));
assert.ok(account.includes("flags.accountSignOut"));
assert.ok(worker.includes('pathname === "/logout"'));
assert.ok(worker.includes('pathname === "/access/sangha"'));
assert.strictEqual(page.includes("ramafoundation.org"), false);

console.log("settings.test.js ok");
