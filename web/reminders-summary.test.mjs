/* node web/reminders-summary.test.mjs */
import assert from "assert";
import { summaryLines } from "./reminders.js";

assert.deepStrictEqual(summaryLines(null), { morning: "Morning off", evening: "Evening off" });
assert.deepStrictEqual(summaryLines({}), { morning: "Morning off", evening: "Evening off" });

const lines = summaryLines({
  morning: { on: true, mode: "sunrise", offset: -15, time: "06:30" },
  evening: { on: true, mode: "clock", offset: 0, time: "19:00" },
});
assert.strictEqual(lines.morning, "Morning on · sunrise · 15 minutes before");
assert.strictEqual(lines.evening, "Evening on · 19:00");

assert.strictEqual(
  summaryLines({ evening: { on: true, mode: "sunset", offset: 30, time: "19:00" } }).evening,
  "Evening on · sunset · 30 minutes after"
);
assert.strictEqual(
  summaryLines({ morning: { on: true, mode: "sunrise", offset: 0, time: "06:30" } }).morning,
  "Morning on · sunrise"
);
assert.strictEqual(
  summaryLines({ morning: { on: false, mode: "clock", time: "05:00" } }).morning,
  "Morning off"
);

const account = await import("fs");
const page = account.readFileSync(new URL("./account.js", import.meta.url), "utf8");
assert.ok(page.includes("summaryLines"));
assert.ok(page.includes("Notification.permission"));
assert.strictEqual(page.includes("requestPermission"), false);

console.log("reminders-summary.test.js ok");
