/* node web/series.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const S = require("./series.js");

function song(index, position, extra) {
  return Object.assign({
    key: "disc:napa",
    lengths: [240, 240, 240, 240],
    index: index,
    position: position,
    length: 240,
    status: "Playing",
    at: 1000,
    chakra: index < 2 ? "naval" : "heart",
  }, extra || {});
}

let state = null;
let out = S.holdSeries(state, song(2, 80), 0);
state = out.state;
assert.strictEqual(out.songChanged, true, "the first report of a sit is the song");
assert.strictEqual(out.series.index, 2);
assert.strictEqual(out.series.chakra, "heart");

out = S.holdSeries(state, null, 400);
state = out.state;
assert.strictEqual(out.songChanged, false);
assert.strictEqual(out.series.index, 2);
assert.strictEqual(out.series.chakra, "heart");

out = S.holdSeries(state, song(2, 81), 700);
state = out.state;
assert.strictEqual(out.songChanged, false);
assert.strictEqual(out.series.position, 81);

out = S.holdSeries(state, song(0, 0, { chakra: "naval" }), 900);
state = out.state;
assert.strictEqual(out.songChanged, false, "a one-frame index change is not a new song");
assert.strictEqual(out.series.index, 2);
assert.strictEqual(out.series.chakra, "heart");

out = S.holdSeries(state, song(2, 82), 1100);
state = out.state;
assert.strictEqual(out.songChanged, false);
assert.strictEqual(out.series.index, 2);

out = S.holdSeries(state, song(2, 0, { status: "Paused", at: 1100 }), 1200);
state = out.state;
assert.strictEqual(out.songChanged, false, "a status blip stays on this song");
assert.strictEqual(out.series.status, "Playing");
assert.strictEqual(out.series.position, 82);
assert.strictEqual(out.series.chakra, "heart");

out = S.holdSeries(state, song(2, 90, { status: "Paused" }), 1200 + S.HOLD_MS);
state = out.state;
assert.strictEqual(out.songChanged, false);
assert.strictEqual(out.series.status, "Paused", "a pause that lasts is kept");
assert.strictEqual(out.series.index, 2);

out = S.holdSeries(state, song(3, 0.4), 4000);
state = out.state;
assert.strictEqual(out.songChanged, true, "the next track at the start is a real advance");
assert.strictEqual(out.series.index, 3);

out = S.holdSeries(state, song(0, 40, { key: "disc:other", chakra: "naval" }), 5000);
state = out.state;
assert.strictEqual(out.songChanged, false);
assert.strictEqual(out.series.key, "disc:napa");
assert.strictEqual(out.series.chakra, "heart");

out = S.holdSeries(state, song(1, 10, { key: "disc:other" }), 5000 + S.STABLE_MS - 1);
state = out.state;
assert.strictEqual(out.songChanged, false, "a flickering key restarts the wait");
assert.strictEqual(out.series.key, "disc:napa");

out = S.holdSeries(state, song(1, 12, { key: "disc:other", chakra: "naval" }), 5000 + S.STABLE_MS - 1 + S.STABLE_MS);
state = out.state;
assert.strictEqual(out.songChanged, true);
assert.strictEqual(out.series.key, "disc:other");
assert.strictEqual(out.series.chakra, "naval");

const acceptedAt = 5000 + S.STABLE_MS - 1 + S.STABLE_MS;
out = S.holdSeries(state, null, acceptedAt + S.HOLD_MS - 1);
assert.strictEqual(out.series.key, "disc:other");
out = S.holdSeries(out.state, null, acceptedAt + S.HOLD_MS);
assert.strictEqual(out.series, null, "a report that stays gone is let go");

let jump = S.holdSeries(null, song(2, 80), 0);
jump = S.holdSeries(jump.state, song(3, 40), 500);
assert.strictEqual(jump.songChanged, false, "the next index mid-song is not yet a new song");
assert.strictEqual(jump.series.index, 2);
jump = S.holdSeries(jump.state, song(3, 0.2), 600);
assert.strictEqual(jump.songChanged, true, "the same step at the start is a real advance");

const ink = { key: "", portion: 0 };
assert.strictEqual(S.forwardPortion(ink, "sit:disc:napa:2", 0.42), 0.42);
assert.strictEqual(S.forwardPortion(ink, "sit:disc:napa:2", 0.1), 0.42, "the ink does not rewind");
assert.strictEqual(S.forwardPortion(ink, "sit:disc:napa:2", 0.55), 0.55);
assert.strictEqual(S.forwardPortion(ink, "sit:disc:napa:3", 0.02), 0.02, "a new song may start over");

let held = null;
let draw = { key: "", portion: 0 };
function step(report, now) {
  const settled = S.holdSeries(held, report, now);
  held = settled.state;
  if (!settled.series) return draw.portion;
  const id = settled.series.key + ":" + settled.series.index;
  const length = settled.series.length || 1;
  const reveal = Math.max(0, Math.min(1, (settled.series.position || 0) / length));
  return S.forwardPortion(draw, "0:" + id, reveal);
}

held = null;
draw = { key: "", portion: 0 };
assert.strictEqual(step(song(2, 100), 0), 100 / 240);
const mid = step(song(2, 110), 1000);
assert.ok(step(null, 1100) >= mid);
assert.ok(step(song(2, 0, { status: "Paused", at: 1200 }), 1200) >= mid);
assert.ok(step(song(0, 0, { chakra: "naval" }), 1300) >= mid);
assert.ok(step(song(3, 1), 1400) < 0.05);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes('src="/web/series.js"'));
assert.ok(page.includes("YantraSeries.holdSeries"));
assert.ok(page.includes("YantraSeries.forwardPortion"));

console.log("series.test.js ok");
