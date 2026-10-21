/* node web/saved-talks.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const store = new Map();
global.localStorage = {
  get length() { return store.size; },
  key(i) { return Array.from(store.keys())[i] || null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
};
global.YantraSettings = require("./settings.js");
const Saved = require("./saved-talks.js");

const id = "rama-live-la-01-consciousness-expansion-and-desire";
const key = "talks/rama-live-la/" + id + ".mp3";

assert.strictEqual(Saved.toggle(id), true);
assert.deepStrictEqual(Saved.saved(), [id]);
assert.strictEqual(Saved.isSaved(id), true);
assert.strictEqual(Saved.toggle(id), false);
assert.deepStrictEqual(Saved.saved(), []);
assert.strictEqual(Saved.toggle("talks/nope.mp3"), false);
assert.strictEqual(Saved.toggle("https://example.com/a.mp3"), false);
assert.deepStrictEqual(Saved.saved(), []);

Saved.toggle(id);
const packed = global.YantraSettings.entries();
assert.deepStrictEqual(packed["talks.saved"].value, [id]);
global.localStorage.setItem("yantra.practice.v1", "{\"days\":{}}");
global.YantraSettings.erase();
assert.deepStrictEqual(global.YantraSettings.get("talks.saved"), []);
assert.strictEqual(global.localStorage.getItem("yantra.settings.v1"), null);
assert.ok(global.localStorage.getItem("yantra.practice.v1"));

const manifest = {
  talks: [
    { id: id, title: "Consciousness, Expansion, and Desire", kind: "talk", r2Key: key },
    { id: "a-quote", title: "A line", kind: "quote", r2Key: null, text: "Sit." },
    { id: "an-example", title: "Example", kind: "talk", example: true, r2Key: "talks/an-example.mp3" },
    { id: "off-site", title: "Off", kind: "talk", r2Key: "https://example.com/off-site.mp3" },
    { id: "mismatch", title: "Mismatch", kind: "talk", r2Key: "talks/other-file.mp3", fileUrl: "https://example.com/file.mp3" },
  ],
};
assert.strictEqual(Saved.rowsOf(manifest).length, 5);
assert.strictEqual(Saved.rowsOf(manifest.talks).length, 5);
const playable = Saved.playable(manifest.talks[0]);
assert.deepStrictEqual(playable, {
  id: id,
  title: "Consciousness, Expansion, and Desire",
  r2Key: key,
  url: "/" + key,
});
assert.ok(playable.url.startsWith("/talks/"));
assert.strictEqual(playable.url.indexOf("http"), -1);
assert.strictEqual(Saved.playable(manifest.talks[1]), null);
assert.strictEqual(Saved.playable(manifest.talks[2]), null);
assert.strictEqual(Saved.playable(manifest.talks[3]), null);
assert.strictEqual(Saved.playable(manifest.talks[4]), null);

const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(account.includes("yantraExportBundle"));
assert.ok(account.includes("entries()"));
assert.ok(account.includes("yantraOpenTalk"));
assert.ok(account.includes('fetch("talks.json"'));
assert.ok(page.includes('id="practice-erase-yes"'));
assert.ok(page.includes("YantraSettings.erase()"));
assert.strictEqual(account.includes("fileUrl"), false);
assert.strictEqual(account.includes("http://"), false);
assert.strictEqual(account.includes("https://"), false);

console.log("saved-talks.test.js ok");
