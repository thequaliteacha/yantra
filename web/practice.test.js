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
assert.strictEqual(picture.streaks.weekly.current, 4);
assert.strictEqual(picture.streaks.weekly.cap, 7);
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

// Start Here on the home page stays until this device has three completed sits.
assert.strictEqual(P.START_HERE_SITS, 3);
assert.strictEqual(P.startHereDue(null), true);
assert.strictEqual(P.startHereDue(P.empty()), true, "no sits yet");
let newer = sit(P.empty(), "2026-10-01", "morning");
assert.strictEqual(P.startHereDue(newer), true, "one sit still shows it");
newer = sit(newer, "2026-10-02", "evening");
assert.strictEqual(P.startHereDue(newer), true, "two sits still show it");
const tooShort = P.record(newer, { date: "2026-10-03", theme: "morning", ms: P.MIN_MS - 1 }).store;
assert.strictEqual(tooShort.totals.sits, 2);
assert.strictEqual(P.startHereDue(tooShort), true, "under a minute does not count as a sit");
newer = sit(newer, "2026-10-03", "morning");
assert.strictEqual(newer.totals.sits, 3);
assert.strictEqual(P.startHereDue(newer), false, "three completed sits hide it");
newer = sit(newer, "2026-10-04", "evening");
assert.strictEqual(P.startHereDue(newer), false, "it stays hidden after more sits");
let oneDay = P.empty();
oneDay = sit(oneDay, "2026-10-08", "morning");
oneDay = sit(oneDay, "2026-10-08", "evening");
oneDay = sit(oneDay, "2026-10-08", "morning");
assert.strictEqual(oneDay.totals.sits, 3);
assert.strictEqual(P.startHereDue(oneDay), false, "three formal sits on one day are enough");
const shelved = P.record(oneDay, { date: "2026-10-08", theme: "other", ms: 120000 });
assert.strictEqual(shelved.counted, false);
assert.strictEqual(shelved.store.totals.sits, 3);
assert.strictEqual(shelved.store.totals.ms, oneDay.totals.ms);

const longer = sit(sit(sit(sit(P.empty(), "2026-09-01", "morning"), "2026-09-01", "evening"), "2026-09-02", "morning"), "2026-09-02", "evening");
assert.strictEqual(P.lead(on(longer, "2026-09-02")), "2 perfect days in a row.");

store = sit(store, "2026-10-04", "morning", 90000);
picture = on(store, "2026-10-04");
assert.strictEqual(picture.streaks.morning.current, 1, "a second sit the same day does not add a day");
assert.strictEqual(picture.today.sits, 2);
assert.strictEqual(picture.totals.sits, 5);

const beforeShelf = store.totals.ms;
const beforeToday = on(store, "2026-10-04").today.ms;
const shelf = P.record(store, { date: "2026-10-04", theme: "", ms: 60000 });
assert.strictEqual(shelf.counted, false);
assert.strictEqual(shelf.store.totals.ms, beforeShelf);
assert.strictEqual(shelf.store.days["2026-10-04"].other, undefined);
picture = on(shelf.store, "2026-10-04");
assert.strictEqual(picture.streaks.morning.current, 1, "a shelf sit does not extend the morning run");
assert.strictEqual(picture.streaks.daily.current, 4);
assert.strictEqual(picture.today.ms, beforeToday, "album time stays out of today");

store = P.empty();
store = sit(store, "2026-10-31", "evening");
store = sit(store, "2026-11-01", "evening");
assert.strictEqual(on(store, "2026-11-01").streaks.evening.current, 2);

const local = new Date(2026, 9, 19, 23, 30);
assert.strictEqual(P.localDate(local), "2026-10-19");
assert.strictEqual(P.addDays("2026-03-08", 1), "2026-03-09");
assert.strictEqual(P.addDays("2026-12-31", 1), "2027-01-01");

// Evening before 2:22 AM belongs to the previous local date. Morning does not.
assert.strictEqual(P.practiceDate(new Date(2026, 9, 21, 0, 15), "evening"), "2026-10-20", "12:15 AM evening is the previous day");
assert.strictEqual(P.practiceDate(new Date(2026, 9, 21, 2, 21), "evening"), "2026-10-20", "2:21 AM evening is still the previous day");
assert.strictEqual(P.practiceDate(new Date(2026, 9, 21, 2, 22), "evening"), "2026-10-21", "2:22 AM evening is that calendar day");
assert.strictEqual(P.practiceDate(new Date(2026, 9, 20, 23, 59), "evening"), "2026-10-20", "11:59 PM evening is that day");
assert.strictEqual(P.practiceDate(new Date(2026, 9, 21, 0, 15), "morning"), "2026-10-21", "12:15 AM morning is that calendar day");
assert.strictEqual(P.practiceDate(new Date(2026, 9, 21, 0, 0), "evening"), "2026-10-20");
assert.strictEqual(P.practiceDate(new Date(2026, 10, 1, 1, 5), "evening"), "2026-10-31", "the carry crosses a month");
assert.strictEqual(P.practiceDate(new Date(2026, 9, 21, 0, 15), ""), "2026-10-21", "a sit with no theme stays on the calendar day");

function hear(theme, start, end) {
  let now = start.getTime();
  const clock = P.createListeningClock(() => now);
  clock.begin(theme);
  clock.observe({ key: "a", position: 0, playing: true, at: now });
  now = end.getTime();
  clock.observe({ key: "a", position: 90, playing: true, at: now });
  return clock.end();
}

const lateEvening = hear("evening", new Date(2026, 9, 21, 0, 10), new Date(2026, 9, 21, 0, 15));
assert.strictEqual(lateEvening.date, "2026-10-20", "a sit that starts after midnight is not frozen on the new day");
assert.strictEqual(P.record(P.empty(), lateEvening).store.days["2026-10-20"].evening, 1);
assert.strictEqual(P.record(P.empty(), lateEvening).store.days["2026-10-21"], undefined);

const acrossMidnight = hear("evening", new Date(2026, 9, 20, 23, 50), new Date(2026, 9, 21, 0, 15));
assert.strictEqual(acrossMidnight.date, "2026-10-20", "finishing after midnight still counts as that evening");
assert.strictEqual(hear("evening", new Date(2026, 9, 20, 23, 40), new Date(2026, 9, 20, 23, 59)).date, "2026-10-20");
assert.strictEqual(hear("evening", new Date(2026, 9, 21, 2, 0), new Date(2026, 9, 21, 2, 21)).date, "2026-10-20");
assert.strictEqual(hear("evening", new Date(2026, 9, 21, 2, 10), new Date(2026, 9, 21, 2, 22)).date, "2026-10-21");
const lateMorning = hear("morning", new Date(2026, 9, 21, 0, 5), new Date(2026, 9, 21, 0, 15));
assert.strictEqual(lateMorning.date, "2026-10-21");
assert.strictEqual(P.record(P.empty(), lateMorning).store.days["2026-10-21"].morning, 1);
assert.strictEqual(P.record(P.empty(), lateMorning).store.days["2026-10-20"], undefined, "morning is not moved to the day before");

const explicit = P.record(P.empty(), { date: "2026-10-21", theme: "evening", ms: P.MIN_MS });
assert.strictEqual(explicit.store.days["2026-10-21"].evening, 1, "an explicit practice date is kept");
assert.strictEqual(explicit.store.days["2026-10-20"], undefined, "stored days are not rewritten");

let evenings = sit(P.empty(), "2026-10-19", "evening");
evenings = P.record(evenings, { theme: "evening", ms: P.MIN_MS, at: new Date(2026, 9, 21, 0, 15).getTime(), date: "2026-10-21" }).store;
assert.strictEqual(evenings.days["2026-10-20"].evening, 1, "commit uses the checkpoint moment, not a frozen midnight date");
assert.strictEqual(evenings.days["2026-10-21"], undefined);
const during = P.summarize(evenings, new Date(2026, 9, 21, 0, 15));
assert.strictEqual(during.streaks.evening.current, 2, "the evening run continues across the window");
assert.strictEqual(during.streaks.evening.last, "2026-10-20");
assert.strictEqual(during.streaks.morning.current, 0);
assert.strictEqual(during.streaks.perfect.current, 0, "evening alone is not a perfect day");
assert.strictEqual(during.today.evening, 1);
assert.strictEqual(during.today.morning, 0, "today's morning is the new calendar day");
assert.strictEqual(during.today.ms, P.MIN_MS);
assert.strictEqual(during.week.filter((day) => day.today).length, 1);
assert.strictEqual(during.week.find((day) => day.today).date, "2026-10-20", "the week marks the evening practice day");
assert.strictEqual(during.week[during.week.length - 1].date, "2026-10-21");
assert.strictEqual(during.week[during.week.length - 1].today, false);
assert.strictEqual(P.completeLine(during, "evening"), "Today, 1 minute. Sit at sunrise and sunset for a perfect day.");

const waiting = P.summarize(sit(P.empty(), "2026-10-19", "evening"), new Date(2026, 9, 21, 0, 15));
assert.strictEqual(waiting.streaks.evening.current, 1, "until 2:22 the previous evening is still yesterday");
assert.strictEqual(P.summarize(sit(P.empty(), "2026-10-19", "evening"), new Date(2026, 9, 21, 2, 21)).streaks.evening.current, 1);
const closed = P.summarize(sit(P.empty(), "2026-10-19", "evening"), new Date(2026, 9, 21, 2, 22));
assert.strictEqual(closed.streaks.evening.current, 0, "at 2:22 a missed evening ends the run");
assert.strictEqual(closed.week.find((day) => day.today).date, "2026-10-21");
assert.strictEqual(waiting.streaks.daily.current, 0, "the daily run still follows the calendar day");
assert.strictEqual(waiting.streaks.weekly.current, 0, "weekly follows the daily run");
assert.strictEqual(P.summarize(evenings, new Date(2026, 9, 21, 0, 15)).streaks.daily.current, 2);
assert.strictEqual(P.summarize(evenings, new Date(2026, 9, 21, 0, 15)).streaks.weekly.current, 2, "an evening before 2:22 still feeds the weekly count");
assert.strictEqual(P.weeklyOf(0), 0);
assert.strictEqual(P.weeklyOf(1), 1);
assert.strictEqual(P.weeklyOf(6), 6);
assert.strictEqual(P.weeklyOf(7), 7);
assert.strictEqual(P.weeklyOf(8), 7, "the eighth day stays at 7");
assert.strictEqual(P.weeklyOf(90), 7);
assert.strictEqual(P.weeklyOf(365), 7);
assert.notStrictEqual(P.weeklyOf(8), 1, "weekly is not the remainder of a cycle");
let weekRun = P.empty();
for (let i = 0; i < 8; i += 1) weekRun = sit(weekRun, P.addDays("2026-01-01", i), i % 2 ? "evening" : "morning");
assert.strictEqual(on(weekRun, "2026-01-08").streaks.daily.current, 8);
assert.strictEqual(on(weekRun, "2026-01-08").streaks.weekly.current, 7);
assert.strictEqual(on(weekRun, "2026-01-09").streaks.weekly.current, 7, "yesterday's formal day still counts");
assert.strictEqual(on(weekRun, "2026-01-10").streaks.daily.current, 0);
assert.strictEqual(on(weekRun, "2026-01-10").streaks.weekly.current, 0, "a missed day ends the weekly count with the daily run");
assert.strictEqual(P.summarize(evenings, new Date(2026, 9, 21, 2, 22)).streaks.evening.current, 2, "after 2:22 the sit already kept stays yesterday");

let perfect = sit(P.empty(), "2026-10-20", "morning");
perfect = P.record(perfect, { theme: "evening", ms: P.MIN_MS, at: new Date(2026, 9, 21, 0, 15).getTime() }).store;
assert.strictEqual(perfect.days["2026-10-20"].morning, 1);
assert.strictEqual(perfect.days["2026-10-20"].evening, 1);
const perfectNow = P.summarize(perfect, new Date(2026, 9, 21, 0, 15));
assert.strictEqual(perfectNow.streaks.perfect.current, 1, "morning and evening on the practice date are a perfect day");
assert.strictEqual(perfectNow.streaks.perfect.last, "2026-10-20");
assert.strictEqual(P.lead(perfectNow), "Sit at sunrise and sunset for 2 perfect days in a row.");
perfect = P.record(perfect, { theme: "morning", ms: P.MIN_MS, at: new Date(2026, 9, 21, 0, 15).getTime() }).store;
assert.strictEqual(perfect.days["2026-10-21"].morning, 1);
assert.strictEqual(perfect.days["2026-10-20"].morning, 1, "the earlier morning stays on its own date");
const afterDawn = P.summarize(perfect, new Date(2026, 9, 21, 0, 15));
assert.strictEqual(afterDawn.streaks.morning.current, 2, "the new morning continues yesterday's morning");
assert.strictEqual(afterDawn.streaks.perfect.current, 1, "a morning after midnight does not finish yesterday");
assert.strictEqual(afterDawn.today.morning, 1);
assert.strictEqual(afterDawn.today.evening, 1);
assert.strictEqual(P.lead(afterDawn), "Sit at sunset for 2 perfect days in a row.");
assert.strictEqual(afterDawn.today.ms, P.MIN_MS * 3, "the new morning and that evening's day both show");

const sharedEvening = P.mergeDays([
  { deviceId: "a".repeat(32), days: { "2026-10-20": { ms: P.MIN_MS, sits: 1, morning: 0, evening: 1 } } },
  { deviceId: "b".repeat(32), days: { "2026-10-21": { ms: P.MIN_MS, sits: 1, morning: 1, evening: 0 } } },
]);
assert.strictEqual(sharedEvening["2026-10-20"].evening, 1, "sync keeps the committing device's practice date");
assert.strictEqual(sharedEvening["2026-10-21"].morning, 1);
assert.strictEqual(sharedEvening["2026-10-21"].evening, 0);

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

function memoryStore() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(key); },
  };
}
const legacy = {
  version: 1,
  totals: { ms: 300000, sits: 4 },
  days: {
    "2026-10-01": { ms: 60000, sits: 1, morning: 1, evening: 0, other: 0 },
    "2026-10-02": { ms: 90000, sits: 1, morning: 0, evening: 0, other: 1 },
    "2026-10-03": { ms: 120000, sits: 2, morning: 1, evening: 0, other: 1 },
  },
  open: { ms: 30000, theme: "", date: "2026-10-04", at: 1 },
};
const moved = P.migrate(legacy);
assert.strictEqual(moved.earlierMs, 120000, "pure album time and an open shelf sit leave the formal record");
assert.strictEqual(moved.store.days["2026-10-02"], undefined);
assert.strictEqual(moved.store.days["2026-10-01"].ms, 60000);
assert.strictEqual(moved.store.days["2026-10-03"].ms, 120000, "a mixed day stays in the formal total");
assert.strictEqual(moved.store.days["2026-10-03"].sits, 1);
assert.strictEqual(moved.store.days["2026-10-03"].other, undefined);
assert.strictEqual(moved.store.totals.ms, 180000);
assert.strictEqual(moved.store.totals.sits, 2);
assert.strictEqual(moved.store.open, null);
assert.strictEqual(P.migrate(moved.store).earlierMs, 0, "migrating again does not invent more earlier time");
global.localStorage = memoryStore();
localStorage.setItem(P.KEY, JSON.stringify(legacy));
const loaded = P.load();
assert.strictEqual(loaded.totals.ms, 180000);
assert.strictEqual(loaded.days["2026-10-02"], undefined);
assert.strictEqual(Number(localStorage.getItem(P.PENDING_KEY)), 120000);
P.load();
assert.strictEqual(Number(localStorage.getItem(P.PENDING_KEY)), 120000, "a second load does not move the album time again");
const formalOpen = {
  version: 1,
  totals: { ms: 0, sits: 0 },
  days: {},
  open: { ms: 80000, theme: "morning", date: "2026-10-01", at: 2 },
};
assert.strictEqual(P.migrate(formalOpen).earlierMs, 0);
assert.strictEqual(P.migrate(formalOpen).store.open.theme, "morning");
const albumRun = {
  version: 1,
  totals: { ms: 120000, sits: 2 },
  days: {
    "2026-10-04": { ms: 60000, sits: 1, morning: 0, evening: 0, other: 1 },
    "2026-10-05": { ms: 60000, sits: 1, morning: 1, evening: 0, other: 0 },
  },
};
const dropped = P.migrate(albumRun).store;
assert.strictEqual(P.streaks(dropped, "2026-10-05").daily.current, 1, "an album-only day does not extend the daily run");

global.localStorage = memoryStore();
const carried = new Date(2026, 9, 21, 0, 15);
const openClock = P.createListeningClock(() => carried.getTime());
openClock.begin("evening");
openClock.observe({ key: "a", position: 0, playing: true, at: carried.getTime() });
openClock.observe({ key: "a", position: 90, playing: true, at: carried.getTime() + 90000 });
P.checkpoint(openClock.snapshot());
assert.strictEqual(P.load().open.date, "2026-10-20", "an open evening before 2:22 is dated the day before");
assert.strictEqual(P.load().open.at, carried.getTime());
assert.strictEqual(P.recover().days["2026-10-20"].evening, 1, "reopening later still commits that evening");
assert.strictEqual(P.load().days["2026-10-21"], undefined);
assert.strictEqual(P.load().open, null);

global.localStorage = memoryStore();
P.save(Object.assign(P.empty(), {
  open: { ms: 90000, theme: "evening", date: "2026-10-21", at: new Date(2026, 9, 21, 0, 15).getTime() },
}));
assert.strictEqual(P.load().open.date, "2026-10-21", "a stored open date is not rewritten on load");
const repaired = P.recover();
assert.strictEqual(repaired.days["2026-10-20"].evening, 1, "commit repairs a frozen midnight date");
assert.strictEqual(repaired.days["2026-10-21"], undefined);

global.localStorage = memoryStore();
P.save(Object.assign(P.empty(), {
  open: { ms: 90000, theme: "evening", date: "2026-10-21", at: new Date(2026, 9, 20, 23, 50).getTime() },
}));
assert.strictEqual(P.recover().days["2026-10-20"].evening, 1, "an evening checkpointed before midnight stays that day");

global.localStorage = memoryStore();
P.save(Object.assign(P.empty(), {
  open: { ms: 90000, theme: "morning", date: "2026-10-20", at: new Date(2026, 9, 21, 0, 15).getTime() },
}));
const dawnOpen = P.recover();
assert.strictEqual(dawnOpen.days["2026-10-21"].morning, 1, "a morning checkpointed after midnight is the new day");
assert.strictEqual(dawnOpen.days["2026-10-20"], undefined);

const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/worker.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const home = page.slice(page.indexOf('id="home"'), page.indexOf('id="welcome"'));
assert.ok(home.includes('id="home-start" data-room="guide" hidden>Start Here</button>'), "the home hint opens the sit guide");
assert.ok(home.indexOf("Evening Meditation") < home.indexOf('id="home-start"'), "it sits below the morning and evening buttons");
assert.ok(home.indexOf('id="home-altar"') < home.indexOf('id="home-start"'), "it is not in the altar row");
assert.ok(home.indexOf('id="home-note"') < home.indexOf('id="home-start"'), "the week and the day line stay above it");
assert.ok(page.includes("startHereDue(practice.load())"), "the count is this device's own history");
assert.ok(!page.includes("startHereDue(summary)"), "linked devices' sits do not retire it");
assert.ok(page.includes('id="start-here" data-room="guide">Start Here</button>'), "the settings guide stays");
const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
assert.strictEqual(web.includes("getUserMedia"), false);
assert.strictEqual(web.includes("mediaDevices"), false);
assert.strictEqual(web.includes("createMediaElementSource"), false);
assert.strictEqual(web.includes("captureStream"), false);
assert.ok(worker.includes("microphone=()"));
assert.strictEqual(worker.includes("microphone=(self)"), false);
assert.strictEqual(/Naval/.test(web + page), false);
assert.ok(sw.includes("yantra-v10"));
assert.ok(sw.includes('"/web/listening.js"'));
assert.ok(readme.includes("Evening continues until 2:22 AM."));
assert.ok(P.RULE.includes("Evening continues until 2:22 AM."));
assert.ok(fs.readFileSync(path.join(__dirname, "sync.js"), "utf8").includes("Evening continues until 2:22 AM."));
assert.ok(fs.readFileSync(path.join(__dirname, "practice.js"), "utf8").includes("An evening sit before 2:22 AM still belongs to the day before."));
assert.ok(readme.includes("36"));
assert.ok(readme.includes("Twenty albums are hosted"));
assert.strictEqual(readme.includes("34 albums"), false);
assert.ok(/never asks for the microphone/i.test(readme));
assert.strictEqual(/through the microphone/i.test(readme), false);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.webmanifest"), "utf8"));
assert.strictEqual(manifest.display, "standalone", "a browser that cannot go fullscreen still opens as an app");
assert.deepStrictEqual(manifest.display_override, ["fullscreen"], "an installed app opens fullscreen where the platform allows it");
const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.ok(loader.includes('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"'), "the first document reaches under the notch");
assert.ok(loader.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"'));
const desktop = fs.readFileSync(path.join(__dirname, "../yantra.py"), "utf8");
assert.ok(desktop.includes('"--class=yantra"'), "Hyprland can recognise the desktop window");
assert.ok(desktop.includes('"--start-fullscreen"'));
assert.ok(desktop.includes("fullscreen = true"));
assert.ok(desktop.includes('mode = "fullscreen"'));
assert.ok(desktop.includes('action = "set"'), "opening fullscreen does not toggle it back off");
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
