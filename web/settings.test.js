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

assert.strictEqual(S.get("bell.sameTone", mem()), true);
assert.strictEqual(S.get("bell.startTone", mem()), "medium");
assert.strictEqual(S.get("bell.endTone", mem()), "medium");
assert.strictEqual(S.get("bell.halfTone", mem()), "medium");
assert.strictEqual(S.get("bell.quarterTone", mem()), "medium");
assert.strictEqual(S.get("bell.threeQuarterTone", mem()), "medium");
S.set("bell.sameTone", false, store);
assert.strictEqual(S.get("bell.sameTone", store), false);
S.set("bell.quarterTone", "deep", store);
S.set("bell.threeQuarterTone", "small", store);
S.set("bell.halfTone", "gong", store);
assert.strictEqual(S.get("bell.quarterTone", store), "deep");
assert.strictEqual(S.get("bell.threeQuarterTone", store), "small");
assert.strictEqual(S.get("bell.halfTone", store), "medium");
assert.strictEqual(S.get("bell.startStrikes", mem()), null);
S.set("bell.endStrikes", "4", store);
assert.strictEqual(S.get("bell.endStrikes", store), 4);
S.set("bell.midStrikes", 2, store);
assert.strictEqual(S.get("bell.midStrikes", store), 2);
S.set("bell.startStrikes", 5, store);
assert.strictEqual(S.get("bell.startStrikes", store), null);
S.set("bell.startStrikes", 0, store);
assert.strictEqual(S.get("bell.startStrikes", store), 0);
S.set("glow.levelLight", 90, store);
assert.strictEqual(S.get("glow.levelLight", store), 90);
S.set("glow.levelLight", 91.6, store);
assert.strictEqual(S.get("glow.levelLight", store), 92);
S.set("glow.levelDark", 400, store);
assert.strictEqual(S.get("glow.levelDark", store), 200);
assert.strictEqual(S.get("glow.levelLight", mem()), null);
assert.strictEqual(S.get("glow.levelDark", mem()), null);
assert.strictEqual(S.get("sit.minutes", mem()), 15);
assert.strictEqual(S.get("sit.background", mem()), "silent");
assert.strictEqual(S.set("sit.minutes", 90, store), 90);
assert.strictEqual(S.set("sit.minutes", "20", store), 20);
assert.strictEqual(S.set("sit.minutes", 91, store), 15);
assert.strictEqual(S.set("sit.minutes", 240, store), 15);
assert.strictEqual(S.set("sit.minutes", 15.5, store), 15);
assert.strictEqual(S.set("sit.minutes", 0, store), 15);
assert.strictEqual(S.set("sit.background", "rain", store), "rain-steady");
assert.strictEqual(S.set("sit.background", "rain-roof", store), "rain-roof");
assert.strictEqual(S.set("sit.background", "ocean", store), "silent");
assert.strictEqual(S.set("sit.bedVolume", 2, store), 1);
assert.strictEqual(S.set("sit.bedVolume", -1, store), 0);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/worker.js"), "utf8");
assert.ok(page.includes(">Log out<"));
assert.ok(page.includes('method="post" action="/logout"'));
assert.ok(page.includes('id="account-practice-block"'));
assert.ok(page.includes('id="practice-rows"'));
assert.strictEqual(page.includes('id="practice" '), false, "one practice page: You");
assert.ok(page.includes('id="account-week"') && page.includes('id="home-week"'));
assert.ok(page.includes('id="account-sync"'));
assert.ok(page.includes('id="account-corner"'));
assert.ok(page.includes('aria-label="Settings"'));
// No access level or Zazen switch on the page: a different word means logging out.
assert.strictEqual(page.includes('id="account-zazen"'), false);
assert.strictEqual(page.includes('id="account-access"'), false);
assert.strictEqual(/Zazen|Rama/.test(account.replace(/"zazen"/g, "")), false, "account.js names neither");
assert.ok(page.includes('id="reminders"'));
const order = [
  'id="start-here"',
  'id="account-altar-block"',
  'id="account-altar"',
  'id="account-profile"',
  'id="account-name"',
  'id="account-sync"',
  'id="account-practice-block"',
  'id="practice-erase"',
  'id="motion-inner"',
  'id="motion-outer"',
  'id="account-devices-block"',
  'id="practice-link"',
  'id="account-reminders-block"',
  'id="account-mindful"',
  'id="account-settings"',
  "<h3>Spotify</h3>",
  "<h3>Privacy</h3>",
  'id="install-app"',
  'id="account-logout"',
];
let cursor = -1;
order.forEach((mark) => {
  const at = page.indexOf(mark);
  assert.ok(at > cursor, mark);
  cursor = at;
});
assert.ok(account.includes("summaryLines"));
assert.ok(account.includes("YantraSavedTalks"));
assert.ok(account.includes("entries()"));
assert.ok(page.includes("YantraSettings.erase"));
assert.ok(fs.readFileSync(path.join(__dirname, "index.html"), "utf8").includes("saved-talks.js"));
assert.strictEqual(page.includes("SANGHA_WORD"), false);
assert.strictEqual(page.includes("ZAZEN_WORD"), false);
assert.ok(account.includes("flags.accountSync"));
assert.ok(account.includes("flags.accountSignOut"));
assert.ok(worker.includes('pathname === "/logout"'));
assert.ok(fs.readFileSync(path.join(__dirname, "sw.js"), "utf8").includes('pathname === "/logout"'));
assert.ok(worker.includes('pathname === "/access/sangha"'));
assert.strictEqual(page.includes('id="account-bell"'), false, "no bell settings");
assert.strictEqual(page.includes('id="account-resources"'), false, "no resource links for now");
assert.ok(page.includes('id="talks-list"'));
assert.ok(page.includes('window.YANTRA_LEVEL !== "zazen"'));
assert.strictEqual(page.includes("ramafoundation.org"), false);

console.log("settings.test.js ok");
assert.strictEqual(require('fs').readFileSync(require('path').join(__dirname, '../index.html'), 'utf8').includes('id="account-glow"'), false, 'the theme lives only on the home toggle');
