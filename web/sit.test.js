/* node web/sit.test.js */
const assert = require("assert");
const S = require("./sit.js");

assert.strictEqual(S.DEFAULT_MINUTES, 15);
assert.deepStrictEqual(S.PRESETS, [5, 10, 15, 20, 30, 45, 60, 90]);
assert.ok(S.PRESETS.every((n) => n <= 90));
assert.strictEqual(S.MAX_MINUTES, 90);
assert.strictEqual(S.minutes(15), 15);
assert.strictEqual(S.minutes(60), 60);
assert.strictEqual(S.minutes(90), 90);
assert.strictEqual(S.minutes(1), 1);
assert.strictEqual(S.minutes(91), null);
assert.strictEqual(S.minutes(240), null);
assert.strictEqual(S.minutes(0), null);
assert.strictEqual(S.minutes(15.5), null);
assert.strictEqual(S.minutes("20"), 20);
assert.strictEqual(S.minutes("no"), null);

const fallback = S.plan({});
assert.strictEqual(fallback.minutes, 15);
assert.strictEqual(fallback.duration, 900);
assert.deepStrictEqual(fallback.events.map((event) => event.position), ["start", "end"]);
assert.strictEqual(fallback.events[0].tone, "medium");
assert.strictEqual(fallback.events[0].strikes, 1);
assert.strictEqual(fallback.events[1].strikes, 3);

const half = S.plan({ minutes: 20, midway: "half", sameTone: false, startTone: "small", halfTone: "deep", endTone: "medium" });
assert.strictEqual(half.events[1].at, 600);
assert.strictEqual(half.events[1].position, "half");
assert.strictEqual(half.events[1].tone, "deep");
assert.strictEqual(half.events[1].strikes, 1);
assert.ok(half.events[1].gain < 1);
assert.strictEqual(half.events[0].tone, "small");
assert.strictEqual(half.events[2].tone, "medium");
assert.strictEqual(half.events[2].at, 1200);

const two = S.plan({ minutes: 60, midway: "two", sameTone: true, startTone: "deep", quarterTone: "small", threeQuarterTone: "medium", endTone: "small" });
assert.deepStrictEqual(two.events.map((event) => [event.position, event.at, event.tone]), [
  ["start", 0, "deep"],
  ["quarter", 900, "deep"],
  ["threeQuarter", 2700, "deep"],
  ["end", 3600, "deep"],
]);

const own = S.plan({ minutes: 60, midway: "two", sameTone: false, startTone: "small", quarterTone: "medium", threeQuarterTone: "deep", endTone: "small" });
assert.deepStrictEqual(own.events.map((event) => [event.position, event.tone, event.strikes, event.at]), [
  ["start", "small", 1, 0],
  ["quarter", "medium", 1, 900],
  ["threeQuarter", "deep", 1, 2700],
  ["end", "small", 3, 3600],
]);
assert.ok(own.events[1].gain < own.events[0].gain);
assert.ok(own.events[2].gain < own.events[0].gain);

const shared = S.plan({ minutes: 40, midway: "two", sameTone: true, startTone: "deep", quarterTone: "small", threeQuarterTone: "medium", endTone: "small" });
assert.ok(shared.events.every((event) => event.tone === "deep"));

const halfwayTone = S.plan({ minutes: 10, midway: "half", sameTone: false, startTone: "small", halfTone: "deep", endTone: "medium" });
assert.deepStrictEqual(halfwayTone.events.map((event) => [event.position, event.tone]), [
  ["start", "small"],
  ["half", "deep"],
  ["end", "medium"],
]);

const fromStore = S.fromSettings((key) => ({
  "sit.minutes": 91,
  "sit.midway": "half",
  "bell.on": true,
  "bell.ending": true,
  "bell.sameTone": false,
  "bell.startTone": "small",
  "bell.halfTone": "medium",
  "bell.endTone": "deep",
}[key]));
assert.strictEqual(fromStore.minutes, 15, "91 falls back to the default");
assert.strictEqual(fromStore.events[1].tone, "medium");
assert.strictEqual(fromStore.events[2].tone, "deep");
assert.strictEqual(fromStore.events[0].strikes, 1);
assert.strictEqual(fromStore.events[2].strikes, 3);

const patterned = S.plan({
  minutes: 20,
  midway: "half",
  startStrikes: 4,
  midStrikes: 2,
  endStrikes: 0,
  sameTone: false,
  startTone: "deep",
  halfTone: "small",
});
assert.deepStrictEqual(patterned.events.map((event) => [event.position, event.strikes, event.tone]), [
  ["start", 4, "deep"],
  ["half", 2, "small"],
]);

const quiet = S.plan({ minutes: 10, midway: "two", startStrikes: 0, midStrikes: 0, endStrikes: 1 });
assert.deepStrictEqual(quiet.events.map((event) => [event.position, event.strikes]), [["end", 1]]);

const quarters = S.plan({ minutes: 40, midway: "two", midStrikes: 3, endStrikes: 4 });
assert.deepStrictEqual(quarters.events.map((event) => [event.position, event.strikes]), [
  ["start", 1],
  ["quarter", 3],
  ["threeQuarter", 3],
  ["end", 4],
]);

const separate = S.fromSettings((key) => ({
  "sit.minutes": 40,
  "sit.midway": "two",
  "bell.sameTone": false,
  "bell.startTone": "small",
  "bell.quarterTone": "medium",
  "bell.threeQuarterTone": "deep",
  "bell.endTone": "small",
  "bell.startStrikes": 2,
  "bell.midStrikes": 1,
  "bell.endStrikes": 4,
}[key]));
assert.deepStrictEqual(separate.events.map((event) => [event.position, event.tone, event.strikes, event.at]), [
  ["start", "small", 2, 0],
  ["quarter", "medium", 1, 600],
  ["threeQuarter", "deep", 1, 1800],
  ["end", "small", 4, 2400],
]);

const linked = S.fromSettings((key) => ({
  "sit.minutes": 40,
  "sit.midway": "two",
  "bell.sameTone": true,
  "bell.startTone": "deep",
  "bell.quarterTone": "small",
  "bell.threeQuarterTone": "medium",
  "bell.endTone": "small",
}[key]));
assert.ok(linked.events.every((event) => event.tone === "deep"));

const kept = S.fromSettings((key) => ({
  "bell.on": false,
  "bell.ending": true,
  "bell.startStrikes": null,
  "bell.endStrikes": 2,
  "sit.midway": "none",
}[key]));
assert.deepStrictEqual(kept.events.map((event) => [event.position, event.strikes]), [["end", 2]]);

const page = require("fs").readFileSync(require("path").join(__dirname, "../index.html"), "utf8");
assert.deepStrictEqual(S.BEDS, ["silent", "white", "pink", "brown", "rain-light", "rain-steady", "rain-roof", "rain-thunder", "drone", "bowl", "pad"]);

function marks(minutes, midway) {
  return S.bellTimes(minutes, midway).marks.map((mark) => [mark.position, mark.at]);
}
assert.deepStrictEqual(marks(15, "none"), [["start", 0], ["end", 900]]);
assert.deepStrictEqual(marks(20, "half"), [["start", 0], ["half", 600], ["end", 1200]]);
assert.deepStrictEqual(marks(60, "two"), [["start", 0], ["quarter", 900], ["threeQuarter", 2700], ["end", 3600]]);
assert.deepStrictEqual(marks(8, "half"), [["start", 0], ["half", 240], ["end", 480]]);
assert.deepStrictEqual(marks(8, "two"), [["start", 0], ["quarter", 120], ["threeQuarter", 360], ["end", 480]]);
const ended = S.plan({ minutes: 15, midway: "none" });
assert.strictEqual(ended.events[ended.events.length - 1].position, "end");
assert.strictEqual(ended.events[ended.events.length - 1].at, 900);
assert.strictEqual(ended.events[ended.events.length - 1].strikes, 3);
assert.deepStrictEqual(S.plan({ minutes: 20, midway: "half" }).events.map((event) => event.at), S.bellTimes(20, "half").marks.map((mark) => mark.at));

console.log("sit.test.js ok");
