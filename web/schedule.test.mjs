/* node web/schedule.test.mjs */
import assert from "assert";
import {
  COPY, addDays, dueReminders, fireAt, formatLocal, localDate, nextFire,
  notificationFor, roundCoord, sanitizeSchedule, zonedToUtc,
} from "./schedule.js";

assert.strictEqual(roundCoord(30.26715), 30.3);
assert.strictEqual(roundCoord(-97.7431), -97.7);
assert.strictEqual(roundCoord("nope"), null);

const clean = sanitizeSchedule({
  tz: "America/Chicago",
  lat: 30.26715,
  lon: -97.7431,
  morning: { on: true, mode: "sunrise", offset: -15, time: "06:30" },
  evening: { on: true, mode: "clock", offset: 0, time: "19:05" },
});
assert.strictEqual(clean.lat, 30.3);
assert.strictEqual(clean.lon, -97.7);
assert.strictEqual(clean.morning.mode, "sunrise");
assert.strictEqual(clean.morning.offset, -15);
assert.strictEqual(clean.evening.mode, "clock");
assert.strictEqual(clean.evening.time, "19:05");
assert.strictEqual(sanitizeSchedule({ tz: "Not/AZone", lat: 1, lon: 2 }).tz, "UTC");

const precise = { tz: "Pacific/Honolulu", lat: 21.3069, lon: -157.8583, morning: { on: true, mode: "sunrise", offset: 0, time: "06:30" }, evening: { on: false, mode: "sunset", offset: 0, time: "19:00" } };
const coarse = sanitizeSchedule(precise);
const date = "2026-06-21";
const preciseAt = fireAt(precise, "morning", date);
const coarseAt = fireAt(coarse, "morning", date);
assert.ok(Math.abs(preciseAt - coarseAt) < 3 * 60 * 1000, "a tenth of a degree stays within a few minutes");
assert.strictEqual(formatLocal(preciseAt, "Pacific/Honolulu").replace(/\s/g, ""), "5:51AM");

const early = fireAt({ ...precise, morning: { ...precise.morning, offset: -15 } }, "morning", date);
assert.strictEqual(preciseAt - early, 15 * 60 * 1000);

const clock = zonedToUtc(2026, 6, 21, 6, 30, "America/Chicago");
assert.strictEqual(formatLocal(clock, "America/Chicago").replace(/\s/g, ""), "6:30AM");
assert.strictEqual(localDate("America/Chicago", clock), "2026-06-21");
assert.strictEqual(addDays("2026-12-31", 1), "2027-01-01");

const record = sanitizeSchedule({
  tz: "America/Chicago",
  lat: 30.3,
  lon: -97.7,
  morning: { on: true, mode: "clock", offset: 0, time: "06:30" },
  evening: { on: true, mode: "clock", offset: 0, time: "19:00" },
});
const morningAt = fireAt(record, "morning", "2026-06-21");
assert.deepStrictEqual(
  dueReminders(record, morningAt + 30 * 1000).map((item) => item.theme),
  ["morning"]
);
assert.strictEqual(dueReminders(record, morningAt + 5 * 60 * 1000).length, 0);
assert.strictEqual(dueReminders(record, morningAt - 10 * 1000).length, 0);
assert.strictEqual(dueReminders({ ...record, sent: { morning: "2026-06-21" } }, morningAt + 1000).length, 0);

const eveningAt = fireAt(record, "evening", "2026-06-21");
assert.strictEqual(dueReminders(record, eveningAt + 1000)[0].theme, "evening");
assert.strictEqual(nextFire(record, morningAt - 1000).theme, "morning");
assert.strictEqual(nextFire({ ...record, sent: { morning: "2026-06-21" } }, morningAt + 1000).theme, "evening");

const sunriseOnly = sanitizeSchedule({
  tz: "Pacific/Honolulu",
  morning: { on: true, mode: "sunrise", offset: 0, time: "06:30" },
  evening: { on: false },
});
assert.strictEqual(fireAt(sunriseOnly, "morning", date), null);

assert.strictEqual(notificationFor("morning").body, COPY.morning);
assert.strictEqual(notificationFor("evening").url, "/web/?ready=evening");
assert.ok(notificationFor("morning").body.includes("stillness"));

console.log("schedule.test.mjs ok");
