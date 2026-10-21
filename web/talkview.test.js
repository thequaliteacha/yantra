/* node web/talkview.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const V = require("./talkview.js");

// Words name what they do to the figure; punctuation and case do not matter.
assert.strictEqual(V.kindOf("Light,"), "light");
assert.strictEqual(V.kindOf("heart's"), "heart");
assert.strictEqual(V.kindOf("enlightenment."), "awake");
assert.strictEqual(V.kindOf("Silence"), "still");
assert.strictEqual(V.kindOf("awareness"), "eye");
assert.strictEqual(V.kindOf("power"), "naval");
assert.strictEqual(V.kindOf("the"), "");
// Everyday words that would fire all the time are left out.
["still", "see", "will", "work", "nothing"].forEach((word) => assert.strictEqual(V.kindOf(word), "", word));

const segments = [
  [1.9, 6.5, "Meditation is a process of expanding your awareness.", [[1.9, "Meditation"], [2.6, "is"], [5.4, "awareness."]]],
  [7.0, 11.0, "Planes of perfect light and silence.", [[7.0, "Planes"], [8.2, "light"], [9.6, "silence."]]],
  [30.7, 34.0, "Enlightenment is love.", [[30.7, "Enlightenment"], [32.0, "is"], [32.4, "love."]]],
];
assert.strictEqual(V.segmentAt(segments, 0.5), -1);
assert.strictEqual(V.segmentAt(segments, 3), 0);
assert.strictEqual(V.segmentAt(segments, 7.5), 1);
assert.strictEqual(V.segmentAt(segments, 12), 1, "a phrase stays up for a breath after it ends");
assert.strictEqual(V.segmentAt(segments, 20), -1, "then the words clear in a long pause");
assert.strictEqual(V.segmentAt([], 3), -1);

assert.deepStrictEqual(V.crossed(segments, 5, 7.9).map((hit) => hit.word), ["awareness.", "Planes"]);
assert.deepStrictEqual(V.crossed(segments, 7.9, 8.5).map((hit) => hit.word), ["light"]);
assert.deepStrictEqual(V.crossed(segments, 9, 9.5), []);
assert.deepStrictEqual(V.crossed(segments, 2, 30), [], "a seek does not flood the figure with every word");

// Playing through: moods lean, motifs rise and decay, each word sends a ring.
const state = V.createState();
V.step(state, segments, 5, 0);
V.step(state, segments, 5.5, 0.5);
assert.strictEqual(state.mood, "eye");
assert.strictEqual(state.ripples.length, 1);
V.step(state, segments, 8.3, 0.25);
assert.ok(state.light > 0.7);
V.step(state, segments, 9.7, 0.25);
assert.ok(state.still > 0.5);
assert.strictEqual(state.ripples.length, 3, "stillness hushes; it sends no ring");
const lit = state.light;
V.step(state, segments, 11, 1.3);
assert.ok(state.light < lit, "light fades");
for (let t = 11.25; t <= 30.5; t += 0.25) V.step(state, segments, t, 0.25);
V.step(state, segments, 30.8, 0.3);
assert.ok(state.awake > 0.7);
V.step(state, segments, 32.5, 0.25);
assert.strictEqual(state.mood, "heart");
for (let t = 33; t < 50; t += 0.25) V.step(state, segments, t, 0.25);
assert.strictEqual(state.ripples.length, 0);
assert.ok(state.light === 0 && state.awake < 0.01);

// Only talk paths load words, and a missing file is simply no words.
(async () => {
  const asked = [];
  const fetcher = async (url) => {
    asked.push(url);
    return url === "/talks/meditation.json"
      ? { ok: true, json: async () => ({ v: 1, segments }) }
      : { ok: false, json: async () => ({}) };
  };
  assert.deepStrictEqual(await V.loadWords("/talks/meditation.mp3", fetcher), segments);
  assert.strictEqual(await V.loadWords("/talks/balance.mp3", fetcher), null);
  assert.strictEqual(await V.loadWords("/talks/../secret.mp3", fetcher), null);
  assert.strictEqual(await V.loadWords("https://example.com/x.mp3", fetcher), null);
  assert.deepStrictEqual(asked, ["/talks/meditation.json", "/talks/balance.json"]);

  const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.ok(loader.includes('src="talkview.js"'));
  assert.ok(page.includes('id="talk-watch" hidden'));
  assert.ok(page.includes('if (window.YANTRA_LEVEL !== "zazen" || !window.YantraTalkView'), "the talk view opens for the Zazen word only");
  assert.ok(!/Rama/.test(page), "the shared page names no one");
  console.log("talkview.test.js ok");
})();
assert.ok(require("fs").readFileSync(require("path").join(__dirname, "web.js"), "utf8").includes(`!url.startsWith("/talks/")`), "talk words reach the site, not the in-page router");

// Sketches: spoken concepts draw a picture, gently paced.
{
  const Sk = require("./sketches.js");
  Object.keys(Sk.WORDS).forEach((name) => {
    assert.ok(Sk.SKETCHES[name], name + " has strokes");
    Sk.strokes(name).forEach((d) => assert.ok(/^M/.test(d), name + " stroke starts with M: " + d));
  });
  assert.strictEqual(V.sketchOf("Mountains,"), "mountain");
  assert.strictEqual(V.sketchOf("the"), "");
  const talk = [
    [0, 4, "The sun over the mountain.", [[0.5, "sun"], [2.0, "mountain."]]],
    [4, 9, "The sun and the ocean and a tree.", [[4.2, "sun"], [6.0, "ocean"], [7.5, "tree."]]],
    [60, 64, "The sun again.", [[60.5, "sun"]]],
  ];
  const st = V.createState();
  for (let t = 0; t <= 9; t += 0.25) V.step(st, talk, t, t ? 0.25 : 0);
  assert.deepStrictEqual(st.sketches.map((sk) => sk.name), ["sun", "wave"],
    "five seconds between sketches; the mountain comes too soon after the sun, the tree too soon after the waves");
  assert.notStrictEqual(st.sketches[0].slot, st.sketches[1].slot);
  for (let t = 9.25; t <= 61; t += 0.25) V.step(st, talk, t, 0.25);
  assert.deepStrictEqual(st.sketches.map((sk) => sk.name), ["sun"], "the sun returns after its rest");
  assert.deepStrictEqual(V.sketchPhase(0.9), { drawn: 0.5, alpha: 1 });
  assert.strictEqual(V.sketchPhase(9).alpha, 0);
  console.log("sketches ok");
}
