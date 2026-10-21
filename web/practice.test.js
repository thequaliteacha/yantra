/* node web/practice.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const P = require("./practice.js");

function sit(store, date, theme, ms) {
  return P.record(store, { date, theme, ms: ms == null ? P.MIN_MS : ms }).store;
}

function on(store, today) {
  return P.summarize(store, new Date(today + "T12:00:00"));
}

const empty = P.empty();
assert.strictEqual(P.record(empty, { date: "2026-10-19", theme: "morning", ms: P.MIN_MS - 1 }).counted, false);
assert.strictEqual(P.record(empty, { date: "2026-10-19", theme: "morning", ms: P.MIN_MS - 1 }).store.totals.sits, 0);

let store = P.empty();
store = sit(store, "2026-10-01", "morning");
store = sit(store, "2026-10-02", "morning");
store = sit(store, "2026-10-03", "evening", 120000);
store = sit(store, "2026-10-04", "morning");

let picture = on(store, "2026-10-04");
assert.strictEqual(picture.streaks.morning.current, 1, "a missed morning ends only the morning run");
assert.strictEqual(picture.streaks.morning.best, 2);
assert.strictEqual(picture.streaks.evening.current, 1, "evening still includes yesterday");
assert.strictEqual(picture.streaks.evening.best, 1);
assert.strictEqual(picture.streaks.daily.current, 4);
assert.strictEqual(picture.totals.sits, 4);
assert.strictEqual(picture.totals.ms, P.MIN_MS * 3 + 120000);
assert.strictEqual(picture.today.ms, P.MIN_MS);

picture = on(store, "2026-10-05");
assert.strictEqual(picture.streaks.morning.current, 1, "yesterday's morning is still alive");
assert.strictEqual(picture.streaks.evening.current, 0, "evening last sat on the 3rd");
assert.strictEqual(picture.streaks.evening.best, 1);
assert.strictEqual(picture.streaks.daily.current, 4);

picture = on(store, "2026-10-06");
assert.strictEqual(picture.streaks.daily.current, 0);
assert.strictEqual(picture.streaks.daily.best, 4);
assert.ok(!P.lead(picture).toLowerCase().includes("miss"));
assert.ok(!P.lead(picture).toLowerCase().includes("broke"));

// A perfect day is a sunrise sit and a sunset sit; the lead line steers toward the next one.
let both = P.empty();
["2026-10-10", "2026-10-11", "2026-10-12"].forEach((d) => { both = sit(sit(both, d, "morning"), d, "evening"); });
assert.strictEqual(on(both, "2026-10-12").streaks.perfect.current, 3);
assert.strictEqual(P.lead(on(both, "2026-10-12")), "3 perfect days in a row, your longest yet.");
assert.strictEqual(P.lead(on(both, "2026-10-13")), "Sit at sunrise and sunset for 4 perfect days in a row.");
let half = sit(both, "2026-10-13", "morning");
assert.strictEqual(on(half, "2026-10-13").streaks.perfect.current, 3, "a morning alone keeps yesterday's run alive");
assert.strictEqual(P.lead(on(half, "2026-10-13")), "Sit at sunset for 4 perfect days in a row.");
assert.strictEqual(P.lead(on(sit(both, "2026-10-13", "evening"), "2026-10-13")), "Sunrise and sunset tomorrow make a perfect day.");
assert.strictEqual(on(both, "2026-10-14").streaks.perfect.current, 0);
assert.strictEqual(P.lead(on(both, "2026-10-14")), "Sit at sunrise and sunset for a perfect day.");
assert.strictEqual(P.lead(on(sit(both, "2026-10-13", "other"), "2026-10-13")), "Sit at sunrise and sunset for 4 perfect days in a row.", "a shelf sit is not half a perfect day");
assert.ok(P.lead({ totals: { ms: 0, sits: 0 } }).startsWith("Sit at sunrise and sunset"));
const longer = sit(sit(sit(sit(P.empty(), "2026-09-01", "morning"), "2026-09-01", "evening"), "2026-09-02", "morning"), "2026-09-02", "evening");
assert.strictEqual(P.lead(on(longer, "2026-09-02")), "2 perfect days in a row.");

store = sit(store, "2026-10-04", "morning", 90000);
picture = on(store, "2026-10-04");
assert.strictEqual(picture.streaks.morning.current, 1, "a second sit the same day does not add a day");
assert.strictEqual(picture.today.sits, 2);
assert.strictEqual(picture.totals.sits, 5);

store = sit(store, "2026-10-04", "", 60000);
picture = on(store, "2026-10-04");
assert.strictEqual(store.days["2026-10-04"].other, 1);
assert.strictEqual(picture.streaks.morning.current, 1, "a shelf sit does not extend the morning run");
assert.strictEqual(picture.streaks.daily.current, 4);

store = P.empty();
store = sit(store, "2026-10-31", "evening");
store = sit(store, "2026-11-01", "evening");
assert.strictEqual(on(store, "2026-11-01").streaks.evening.current, 2);

const local = new Date(2026, 9, 19, 23, 30);
assert.strictEqual(P.localDate(local), "2026-10-19");
assert.strictEqual(P.addDays("2026-03-08", 1), "2026-03-09");
assert.strictEqual(P.addDays("2026-12-31", 1), "2027-01-01");

const clock = P.createListeningClock(() => 0);
let at = 0;
clock.begin("morning");
clock.observe({ key: "a", position: 0, playing: true, at: at });
at += 30000;
clock.observe({ key: "a", position: 30, playing: true, at: at });
at += 120000;
clock.observe({ key: "a", position: 30, playing: false, at: at });
at += 40000;
clock.observe({ key: "a", position: 30, playing: true, at: at });
at += 40000;
clock.observe({ key: "a", position: 70, playing: true, at: at });
assert.strictEqual(Math.round(clock.snapshot().ms / 1000), 70, "paused time is not counted");

at += 1000;
clock.observe({ key: "a", position: 170, playing: true, at: at });
assert.strictEqual(Math.round(clock.snapshot().ms / 1000), 71, "a forward seek counts only the wall clock");

at += 1000;
clock.observe({ key: "b", position: 1, playing: true, at: at });
assert.strictEqual(Math.round(clock.snapshot().ms / 1000), 71, "a new song does not add the jump");

at += 120000;
clock.observe({ key: "b", position: 121, playing: true, at: at });
assert.strictEqual(Math.round(clock.snapshot().ms / 1000), 191, "lock-screen playback still counts");
assert.strictEqual(clock.snapshot().theme, "morning");
assert.strictEqual(clock.end().ms > 0, true);
assert.strictEqual(clock.active(), false);

const loud = new Float32Array(8000);
const quiet = new Float32Array(8000);
for (let i = 0; i < loud.length; i += 1) {
  loud[i] = 0.5 * Math.sin(i / 8);
  quiet[i] = 0.02 * Math.sin(i / 8);
}
const mixed = new Float32Array(loud.length + quiet.length);
mixed.set(loud, 0);
mixed.set(quiet, loud.length);
const env = P.envelopeFromChannel(mixed, 8000, 8);
assert.ok(env.values[1] > env.values[env.values.length - 2], "the envelope follows the music");
assert.ok(env.values.every((value) => value >= 0.12 && value <= 0.54));

const first = P.summarize(sit(P.empty(), "2026-10-19", "morning", 4 * 60000), new Date("2026-10-19T08:00:00"));
assert.strictEqual(P.completeLine(first, "morning"), "Today, 4 minutes. Sit at sunset for a perfect day.");
const week = sit(sit(sit(P.empty(), "2026-10-17", "morning"), "2026-10-18", "morning"), "2026-10-19", "morning", 14 * 60000);
assert.strictEqual(
  P.completeLine(P.summarize(week, new Date("2026-10-19T08:00:00")), "morning"),
  "Today, 14 minutes. Sit at sunset for a perfect day."
);
assert.ok(!P.completeLine(first, "morning").toLowerCase().includes("streak"));
assert.strictEqual(P.formatSpan(2 * 3600000 + 5 * 60000), "2 hours 5 minutes");

const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/worker.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
assert.strictEqual(web.includes("getUserMedia"), false);
assert.strictEqual(web.includes("mediaDevices"), false);
assert.strictEqual(web.includes("createMediaElementSource"), false);
assert.strictEqual(web.includes("captureStream"), false);
assert.ok(worker.includes("microphone=()"));
assert.strictEqual(worker.includes("microphone=(self)"), false);
assert.strictEqual(/Naval/.test(web + page), false);
assert.ok(sw.includes("yantra-v5"));
assert.ok(readme.includes("36"));
assert.ok(readme.includes("Twenty albums are hosted"));
assert.strictEqual(readme.includes("34 albums"), false);
assert.ok(/never asks for the microphone/i.test(readme));
assert.strictEqual(/through the microphone/i.test(readme), false);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.webmanifest"), "utf8"));
const origin = "https://yantramedi.app";
const manifestUrl = new URL("/web/manifest.webmanifest", origin);
const start = new URL(manifest.start_url, manifestUrl);
const scope = new URL(manifest.scope, manifestUrl);
assert.strictEqual(start.pathname, "/web/");
assert.ok(start.href.startsWith(scope.href), "the installed app opens inside its scope");
for (const icon of manifest.icons) {
  const resolved = new URL(icon.src, manifestUrl);
  assert.strictEqual(resolved.origin, origin);
  assert.ok(resolved.pathname.startsWith("/web/icons/"));
  assert.ok(fs.existsSync(path.join(__dirname, "..", resolved.pathname.slice(1))));
}
for (const pagePath of ["/web/", "/web/index.html"]) {
  const installed = new URL(pagePath, origin);
  assert.ok(installed.href.startsWith(scope.href));
  assert.strictEqual(new URL("/web/manifest.webmanifest", installed).pathname, "/web/manifest.webmanifest");
}
assert.ok(worker.includes('rel="apple-touch-icon" href="/web/icons/apple-touch-icon.png"'));
assert.ok(worker.includes('rel="icon" href="/web/icons/icon.svg"'));
assert.ok(worker.includes('rel="manifest" href="/web/manifest.webmanifest"'));
assert.ok(worker.includes('name="apple-mobile-web-app-title" content="Yantra"'));
assert.ok(worker.includes('name="apple-mobile-web-app-capable" content="yes"'));
assert.ok(worker.includes('name="mobile-web-app-capable" content="yes"'));
const iconMap = {};
const iconBlock = worker.match(/const ROOT_ICON = \{([\s\S]*?)\};/);
assert.ok(iconBlock);
for (const match of iconBlock[1].matchAll(/"([^"]+)": "([^"]+)"/g)) iconMap[match[1]] = match[2];
assert.strictEqual(iconMap["/apple-touch-icon.png"], "/web/icons/apple-touch-icon.png");
assert.strictEqual(iconMap["/apple-touch-icon-precomposed.png"], "/web/icons/apple-touch-icon.png");
assert.strictEqual(iconMap["/favicon.ico"], "/web/icons/icon-192.png");
for (const target of Object.values(iconMap)) {
  assert.ok(fs.existsSync(path.join(__dirname, "..", target.slice(1))), target);
}
assert.ok(page.includes('src="/web/series.js"'));
require("./series.test.js");

console.log("practice.test.js ok");
