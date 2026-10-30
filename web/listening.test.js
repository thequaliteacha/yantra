/* node web/listening.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const L = require("./listening.js");
const P = require("./practice.js");

function memory() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

const store = memory();
global.localStorage = store;

const now = new Date("2026-10-30T18:00:00");
const yesterday = Date.parse("2026-10-29T21:00:00");
const earlierDay = Date.parse("2026-10-02T12:00:00");

const clock = L.createClock(() => 0);
let at = 0;
clock.begin("album");
clock.observe({ key: "samurai#1", position: 0, playing: true, at: at });
at += 30000;
clock.observe({ key: "samurai#1", position: 30, playing: true, at: at });
at += 120000;
clock.observe({ key: "samurai#1", position: 30, playing: false, at: at });
at += 40000;
clock.observe({ key: "samurai#2", position: 0, playing: true, at: at });
at += 80000;
clock.observe({ key: "samurai#2", position: 80, playing: true, at: at });
assert.strictEqual(Math.round(clock.snapshot().parts.samurai / 1000), 110, "paused time is not counted");
at += 1000;
clock.observe({ key: "samurai#2", position: 180, playing: true, at: at });
assert.strictEqual(Math.round(clock.snapshot().parts.samurai / 1000), 111, "a forward seek counts only the wall clock");
at += 1000;
clock.observe({ key: "tantra#1", position: 0, playing: true, at: at });
at += 70000;
clock.observe({ key: "tantra#1", position: 70, playing: true, at: at });
const heard = clock.end();
assert.strictEqual(clock.active(), false);
assert.strictEqual(Math.round(heard.parts.samurai / 1000), 111);
assert.strictEqual(Math.round(heard.parts.tantra / 1000), 70);

L.commit({ kind: "album", parts: { samurai: 20 * 1000 }, lastAt: yesterday });
assert.strictEqual(L.load().albums.samurai.ms, 20000);
assert.strictEqual(L.load().totals.ms, 20000);
let view = L.rowsFor(L.load(), {
  level: "zazen",
  discs: [{ id: "samurai", title: "Samurai" }],
  now: now,
});
assert.strictEqual(view.totalLine, "", "under a minute stays stored and unshown");

L.commit({ kind: "album", parts: heard.parts, lastAt: yesterday });
L.commit({
  kind: "talk",
  parts: { "/talks/dharma/balance.mp3": 90 * 60000 },
  lastAt: earlierDay,
});
L.commit({
  kind: "album",
  parts: { "awake-in-anza-borrego": 30 * 60000 },
  lastAt: Date.parse("2026-10-30T08:00:00"),
});
const practiceBefore = P.load().totals.ms;
assert.strictEqual(practiceBefore, 0, "listening commits do not write the formal record");
assert.ok(L.load().totals.ms > L.load().albums.samurai.ms);
assert.strictEqual(
  L.load().totals.ms,
  L.load().albums.samurai.ms + L.load().albums.tantra.ms + L.load().albums["awake-in-anza-borrego"].ms + L.load().talks["/talks/dharma/balance.mp3"].ms
);

const discs = [
  { id: "samurai", title: "Samurai" },
  { id: "awake-in-anza-borrego", title: "Awake in Anza Borrego" },
];
const talkTitles = { "/talks/dharma/balance.mp3": "Balance" };
view = L.rowsFor(L.load(), { level: "sangha", discs: [{ id: "samurai", title: "Samurai" }], talkTitles: talkTitles, now: now });
assert.ok(view.items.every((item) => item.id === "samurai"));
assert.strictEqual(view.items.some((item) => item.kind === "talk"), false);
assert.ok(!view.totalLine.includes("Anza"));
const sanghaMs = view.visibleMs;

view = L.rowsFor(L.load(), { level: "zazen", discs: discs, talkTitles: talkTitles, now: now });
assert.strictEqual(view.items[0].id, "awake-in-anza-borrego", "newest lastAt is first");
assert.ok(view.items.some((item) => item.id === "/talks/dharma/balance.mp3"));
assert.ok(view.totalLine.startsWith("Mindfulness · "));
assert.ok(view.visibleMs > sanghaMs);
assert.strictEqual(L.load().albums.tantra.ms, 70000);
assert.strictEqual(view.visibleMs + L.load().albums.tantra.ms, L.load().totals.ms, "a short album not on this shelf stays in the stored total only");

const gated = L.rowsFor(L.load(), { level: "sangha", discs: [{ id: "samurai", title: "Samurai" }], talkTitles: talkTitles, now: now });
assert.ok(gated.visibleMs < L.load().totals.ms, "gated album and talk minutes stay out of the sangha line");
assert.strictEqual(L.load().albums["awake-in-anza-borrego"].ms, 30 * 60000, "the gated album stays stored");

assert.strictEqual(L.albumLine("samurai", now).includes("last listened"), true);
assert.strictEqual(L.talkLine("/talks/dharma/balance.mp3").startsWith("heard "), true);
assert.strictEqual(L.albumLine("awake-in-anza-borrego", now).includes("Mindfulness"), false);

L.absorbEarlier(45 * 60000);
assert.strictEqual(L.load().earlier.ms, 45 * 60000);
assert.strictEqual(L.load().totals.ms, L.load().albums.samurai.ms + L.load().albums.tantra.ms + L.load().albums["awake-in-anza-borrego"].ms + L.load().talks["/talks/dharma/balance.mp3"].ms + 45 * 60000);
view = L.rowsFor(L.load(), { level: "zazen", discs: discs, talkTitles: talkTitles, now: now });
assert.strictEqual(view.earlier, 45 * 60000);
assert.ok(view.totalLine.startsWith("Mindfulness · "));

const killed = L.createClock(() => 0);
killed.begin("album");
killed.observe({ key: "samurai#3", position: 0, playing: true, at: 0 });
killed.observe({ key: "samurai#3", position: 50, playing: true, at: 50000 });
const beforeKill = L.load().albums.samurai.ms;
L.checkpoint(killed.snapshot());
assert.ok(L.load().open);
L.recover();
assert.strictEqual(L.load().open, null);
assert.ok(L.load().albums.samurai.ms > beforeKill);
const afterRecover = L.load().albums.samurai.ms;
L.recover();
assert.strictEqual(L.load().albums.samurai.ms, afterRecover, "recovering twice does not add the partial listen again");

const deviceA = "a".repeat(32);
const deviceB = "b".repeat(32);
const merged = L.merge([
  { deviceId: deviceA, listening: { albums: { samurai: { ms: 60000, lastAt: 10 } }, earlier: { ms: 5000 }, talks: {} } },
  { deviceId: deviceB, listening: { albums: { samurai: { ms: 90000, lastAt: 40 } }, talks: { "/talks/dharma/balance.mp3": { ms: 60000, lastAt: 30 } }, earlier: { ms: 0 } } },
  { deviceId: deviceA, listening: { albums: { samurai: { ms: 60000, lastAt: 10 } } } },
]);
assert.strictEqual(merged.albums.samurai.ms, 150000);
assert.strictEqual(merged.albums.samurai.lastAt, 40);
assert.strictEqual(merged.talks["/talks/dharma/balance.mp3"].ms, 60000);
assert.strictEqual(merged.earlier.ms, 5000);
assert.strictEqual(merged.totals.ms, 150000 + 60000 + 5000);

const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(web.includes("function formalSit()"));
assert.ok(web.includes("Listening.beginAlbum()"));
assert.ok(web.includes("Listening.endAlbum()"));
assert.ok(web.includes("formalSit() && listening.active()"));
assert.ok(page.includes('id="mindful-total"'));
assert.ok(page.includes('id="disc-listened"'));
assert.ok(page.includes("paintMindfulness()"));
assert.strictEqual(page.includes('id="motion-heart"'), false);

console.log("listening.test.js ok");
