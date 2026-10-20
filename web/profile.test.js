/* node web/profile.test.js */
const assert = require("assert");
const P = require("./profile.js");

assert.deepStrictEqual(P.normalize(null), { name: "", greeting: "none" });
assert.deepStrictEqual(P.normalize({ name: "  Ada   Lovelace  ", greeting: "time" }), { name: "Ada Lovelace", greeting: "time" });
assert.strictEqual(P.normalize({ name: "x".repeat(80), greeting: "nope" }).name.length, 40);
assert.strictEqual(P.normalize({ name: "Ada\nLovelace", greeting: "hello" }).name, "AdaLovelace");

assert.strictEqual(P.line({ greeting: "none", name: "Ada" }, new Date(2026, 9, 20, 8)), "");
assert.strictEqual(P.line({ greeting: "hello", name: "Ada" }, new Date(2026, 9, 20, 21)), "Hello, Ada.");
assert.strictEqual(P.line({ greeting: "hello", name: "" }, new Date(2026, 9, 20, 21)), "Hello.");
assert.strictEqual(P.line({ greeting: "time", name: "Ada" }, new Date(2026, 9, 20, 8)), "Good morning, Ada.");
assert.strictEqual(P.line({ greeting: "time", name: "Ada" }, new Date(2026, 9, 20, 14)), "Good afternoon, Ada.");
assert.strictEqual(P.line({ greeting: "time", name: "" }, new Date(2026, 9, 20, 20)), "Good evening.");

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

const store = mem({
  "yantra.profile.v1": "{}",
  "yantra.spotify": "{}",
  "yantra.practice.v1": "{}",
  "other.note": "keep",
});
assert.deepStrictEqual(P.listYantraKeys(store).sort(), ["yantra.practice.v1", "yantra.profile.v1", "yantra.spotify"]);
P.clearYantra(store);
assert.strictEqual(store.getItem("other.note"), "keep");
assert.strictEqual(store.getItem("yantra.spotify"), null);
assert.strictEqual(store.length, 1);

const page = require("fs").readFileSync(require("path").join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes('id="account"'));
assert.ok(page.includes("Erase everything on this device"));
assert.ok(page.includes('data-room="account"'));
assert.ok(page.includes('id="home-greeting"'));

console.log("profile.test.js ok");
