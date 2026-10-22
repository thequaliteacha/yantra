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
assert.ok(V.brightness(state) > 0.5, "a light cue triggers the brightness");
V.step(state, segments, 9.7, 0.25);
assert.ok(state.still > 0.5);
assert.strictEqual(state.ripples.length, 3, "stillness hushes; it sends no ring");
const lit = state.light;
V.step(state, segments, 11, 1.3);
assert.ok(state.light < lit, "light fades");
for (let t = 11.25; t <= 30.5; t += 0.25) V.step(state, segments, t, 0.25);
V.step(state, segments, 30.8, 0.3);
assert.ok(state.awake > 0.7);
assert.ok(V.brightness(state) > 0.5, "an enlightenment cue triggers the brightness");
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

// A mountain, or any other sketched concept, does not brighten the field and is not drawn.
// Light and enlightenment still do.
{
  const talk = [
    [0, 6, "It's like climbing the top of the Himalayas and just seeing the ranges of mountains up", [
      [0.4, "It's"], [1.0, "like"], [1.6, "climbing"], [2.4, "Himalayas"], [3.4, "seeing"], [4.6, "mountains"], [5.4, "up"],
    ]],
    [8, 12, "A perfect light.", [[8.2, "A"], [9.0, "perfect"], [10.2, "light."]]],
    [28, 32, "This is enlightenment.", [[28.4, "This"], [29.2, "is"], [30.2, "enlightenment."]]],
  ];
  const st = V.createState();
  const play = (from, to) => {
    let t = from;
    while (t < to - 1e-6) {
      const next = Math.min(to, Math.round((t + 0.25) * 1000) / 1000);
      V.step(st, talk, next, next - t);
      t = next;
    }
  };
  play(0, 6);
  assert.strictEqual(V.brightness(st), 0, "mountains and the climb do not brighten the field");
  assert.strictEqual(st.mood, "eye", "seeing still leans the figure");
  assert.ok(!Object.prototype.hasOwnProperty.call(st, "sketches"));
  assert.deepStrictEqual(V.crossed(talk, 4, 5.5).map((hit) => hit.word), [], "a mountain is not a motif");
  play(6, 10.25);
  assert.ok(V.brightness(st) > 0.5, "a light cue triggers the brightness");
  const lit = V.brightness(st);
  play(10.25, 22);
  assert.ok(V.brightness(st) < lit * 0.4, "the brightness fades after the word");
  play(22, 30.25);
  assert.ok(V.brightness(st) > 0.5, "an enlightenment cue triggers the brightness");
  assert.ok(st.awake > 0.7);

  function clearOf(box) {
    const bands = V.glowBands(box);
    assert.ok(bands.half > box.R * 2.5, "the wash starts outside the square");
    for (const rect of bands.rects) {
      const overlapsFigure = rect.y0 < box.cy + bands.half && rect.y1 > box.cy - bands.half;
      assert.strictEqual(overlapsFigure, false, "the wash stays off the yantra");
      assert.ok(rect.y1 <= box.captionTop - 8, "the wash stays off the words");
      assert.ok(rect.y0 >= (box.altarBottom || 0) - 0.01, "the wash stays off the altar");
      assert.ok(rect.x0 >= 0 && rect.x1 <= box.w && rect.y0 >= 0 && rect.y1 <= box.h);
      assert.ok(rect.y1 - rect.y0 >= 12 && rect.x1 > rect.x0);
    }
    return bands;
  }
  const phoneR = 390 * 0.155;
  const phone = clearOf({ w: 390, h: 844, cx: 195, cy: 422, R: phoneR, captionTop: 670, altarBottom: 0 });
  assert.ok(phone.rects.length >= 1, "a phone has room for the brightness");
  const ipadR = 820 * 0.155;
  const ipad = clearOf({ w: 820, h: 1180, cx: 410, cy: 590, R: ipadR, captionTop: 990, altarBottom: 88 });
  assert.ok(ipad.rects.length >= 1, "an iPad has room for the brightness");
  const land = clearOf({ w: 1180, h: 820, cx: 590, cy: 410, R: ipadR, captionTop: 640, altarBottom: 88 });
  assert.ok(land.rects.every((rect) => rect.y1 <= 640 - 8));
  const mini = clearOf({ w: 768, h: 1024, cx: 384, cy: 512, R: 768 * 0.155, captionTop: 834, altarBottom: 0 });
  assert.ok(mini.rects.length >= 1, "an iPad mini portrait still has the brightness above the figure");

  const phonePlace = V.placeFigure({ w: 390, h: 844, cx: 195, cy: 422, R: phoneR, captionTop: 679 });
  assert.ok(Math.abs(phonePlace.cy - 422) < 0.01 && Math.abs(phonePlace.R - phoneR) < 0.01, "a phone keeps the yantra where it was");
  const ipadPlace = V.placeFigure({ w: 820, h: 1180, cx: 410, cy: 590, R: ipadR, captionTop: 996 });
  assert.ok(Math.abs(ipadPlace.cy - 590) < 0.01 && Math.abs(ipadPlace.R - ipadR) < 0.01, "a portrait iPad keeps the yantra centred");
  const landPlace = V.placeFigure({ w: 1180, h: 820, cx: 590, cy: 410, R: ipadR, captionTop: 636 });
  assert.ok(landPlace.cy + landPlace.R * landPlace.extent <= 636 - 16, "landscape iPad keeps the square above the words");
  assert.ok(landPlace.cy - landPlace.R * landPlace.extent >= 20, "landscape iPad keeps the square on screen");

  const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.ok(!loader.includes("sketches.js"));
  assert.strictEqual(fs.existsSync(path.join(__dirname, "sketches.js")), false);
  assert.ok(!page.includes("drawSketches") && !page.includes("k-sketch") && !page.includes("YantraSketches"));
  assert.ok(page.includes("talkShine") && page.includes("YantraTalkView.brightness") && page.includes("glowBands"));
  assert.ok(page.includes('if (window.YANTRA_LEVEL !== "zazen" || !window.YantraTalkView'), "Rama talks stay on the Zazen word");
  console.log("brightness ok");
}
