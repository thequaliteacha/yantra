/* node web/bell.test.js */
const assert = require("assert");
const B = require("./bell.js");

assert.strictEqual(B.strikeGap("small"), 1.4);
assert.strictEqual(B.strikeGap("medium"), 2.4);
assert.strictEqual(B.strikeGap("deep"), 4.2);
assert.strictEqual(B.strikeGap("unknown"), 2.4);

Object.keys(B.PARTIALS).forEach((tone) => {
  const gap = B.strikeGap(tone);
  B.PARTIALS[tone].parts.forEach((part) => {
    assert.ok(gap >= part[2], tone + " gap covers the decay");
  });
  const hits = B.onsets(5, tone, 4);
  assert.strictEqual(hits.length, 4);
  assert.strictEqual(hits[0], 5);
  for (let i = 1; i < hits.length; i += 1) {
    assert.ok(hits[i] - hits[i - 1] >= gap - 1e-9, tone + " waits for the previous ring");
  }
});

assert.deepStrictEqual(B.onsets(0, "deep", 0), []);
assert.deepStrictEqual(B.onsets(1, "small", 2), [1, 2.4]);
assert.deepStrictEqual(B.onsets(0, "medium", 9), []);
assert.strictEqual(typeof B.unlock, "function");
assert.strictEqual(B.unlock(), false);

const fs = require("fs");
const path = require("path");
const bell = fs.readFileSync(path.join(__dirname, "bell.js"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(bell.includes("createBuffer(1, 1"));
assert.strictEqual(bell.includes(".pause("), false);
assert.strictEqual(bell.includes("mediaSession"), false);
assert.strictEqual(bell.includes("setInterval"), false);
assert.strictEqual(bell.includes("setTimeout"), false);
assert.ok(page.includes(">Meditation bell<"));
["sitAlbum", "playForm", "playSession"].forEach((name) => {
  const start = page.indexOf("async function " + name);
  const awaited = page.indexOf("await", start);
  assert.ok(start > 0 && awaited > start, name);
  assert.ok(page.slice(start, awaited).includes("YantraBell.unlock"), name + " unlocks inside the tap");
});

assert.ok(bell.includes('["bell.halfTone", "Halfway"]'));
assert.ok(bell.includes('["bell.quarterTone", "25%"]'));
assert.ok(bell.includes('["bell.threeQuarterTone", "75%"]'));
assert.ok(bell.includes('["bell.startTone", "Start"]'));
assert.ok(bell.includes('["bell.endTone", "End"]'));
assert.strictEqual(bell.includes("positions.hidden"), false);
assert.strictEqual(bell.includes("bell.midTone"), false);
assert.ok(bell.includes('preview(select.value, 1)'));

function FakeAudio() {
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.state = "running";
  this.destination = {};
  this.starts = [];
  FakeAudio.latest = this;
}
FakeAudio.prototype.resume = function () { this.state = "running"; return Promise.resolve(); };
FakeAudio.prototype.createGain = function () {
  return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} };
};
FakeAudio.prototype.createOscillator = function () {
  const audio = this;
  const osc = { type: "sine", frequency: { value: 0 }, connect() {}, start(when) { audio.starts.push({ when: when, hz: osc.frequency.value }); }, stop() {} };
  return osc;
};
FakeAudio.prototype.createBuffer = function () { return {}; };
FakeAudio.prototype.createBufferSource = function () {
  return { buffer: null, connect() {}, start() {}, stop() {} };
};
FakeAudio.prototype.createBiquadFilter = function () {
  return { frequency: { value: 0 }, connect() {} };
};

function fundamentals(audio) {
  const groups = [];
  audio.starts.forEach((hit) => {
    const last = groups[groups.length - 1];
    if (!last || Math.abs(last.when - hit.when) > 0.001) groups.push({ when: hit.when, hz: hit.hz });
    else if (hit.hz < last.hz) last.hz = hit.hz;
  });
  return groups;
}

const store = {
  "sit.minutes": 20,
  "sit.midway": "two",
  "sit.background": "silent",
  "bell.on": true,
  "bell.ending": true,
  "bell.volume": 1,
  "bell.sameTone": false,
  "bell.startTone": "small",
  "bell.halfTone": "deep",
  "bell.quarterTone": "medium",
  "bell.threeQuarterTone": "deep",
  "bell.endTone": "small",
  "bell.startStrikes": 1,
  "bell.midStrikes": 1,
  "bell.endStrikes": 1,
};
global.window = { AudioContext: FakeAudio };
require("./sit.js");
window.YantraSettings = { get(key) { return store[key]; } };
delete require.cache[require.resolve("./bell.js")];
const live = require("./bell.js");
live.beginSit(true);
const played = fundamentals(FakeAudio.latest);
assert.deepStrictEqual(played.map((group) => group.hz), [880, 432, 174, 880]);
assert.deepStrictEqual(played.map((group) => Math.round((group.when - played[0].when) * 1000) / 1000), [0, 300, 900, 1200]);

store["bell.sameTone"] = true;
store["bell.startTone"] = "deep";
FakeAudio.latest.starts = [];
live.beginSit(true);
assert.deepStrictEqual(fundamentals(FakeAudio.latest).map((group) => group.hz), [174, 174, 174, 174]);

store["bell.sameTone"] = false;
store["sit.minutes"] = 10;
store["sit.midway"] = "half";
store["bell.startTone"] = "small";
store["bell.halfTone"] = "deep";
store["bell.endTone"] = "medium";
FakeAudio.latest.starts = [];
live.beginSit(true);
const halfway = fundamentals(FakeAudio.latest);
assert.deepStrictEqual(halfway.map((group) => group.hz), [880, 174, 432]);
assert.deepStrictEqual(halfway.map((group) => Math.round((group.when - halfway[0].when) * 1000) / 1000), [0, 300, 600]);

FakeAudio.latest.starts = [];
live.beginSit(false);
assert.deepStrictEqual(fundamentals(FakeAudio.latest).map((group) => group.hz), [880], "a music sit rings only the start tone");

FakeAudio.latest.starts = [];
live.preview("deep", 1);
assert.strictEqual(Math.min.apply(null, FakeAudio.latest.starts.map((hit) => hit.hz)), 174);
FakeAudio.latest.starts = [];
live.preview("small", 1);
assert.strictEqual(Math.min.apply(null, FakeAudio.latest.starts.map((hit) => hit.hz)), 880);

console.log("bell.test.js ok");
