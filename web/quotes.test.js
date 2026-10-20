/* node web/quotes.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Q = require("./quotes.js");
const T = require("./talks.js");

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const marker = "const RAMA_WORDS = ";
const start = page.indexOf(marker);
assert.ok(start > 0);
const end = page.indexOf("\n];", start);
const rama = new Function("return " + page.slice(start + marker.length, end + 3))();
const file = JSON.parse(fs.readFileSync(path.join(__dirname, "quotes.json"), "utf8"));

assert.strictEqual(file.quotes.length, rama.length);
file.quotes.forEach((quote, index) => {
  assert.strictEqual(quote.text, rama[index][0]);
  assert.strictEqual(quote.talk, rama[index][1]);
  assert.strictEqual(quote.source, rama[index][2]);
  quote.themes.forEach((theme) => {
    assert.ok(file.themes.includes(theme));
    assert.ok(quote.text.toLowerCase().includes(theme));
  });
});

const talks = JSON.parse(fs.readFileSync(path.join(__dirname, "talks.json"), "utf8"));
const pool = Q.poolFrom(file, talks);
assert.strictEqual(pool.length, 8);
assert.ok(pool.every((quote) => rama.some((row) => row[0] === quote.text)));
assert.ok(!pool.some((quote) => quote.text.startsWith("Example quote")));
assert.ok(pool.every((quote) => quote.source.startsWith("https://www.ramameditationsociety.org/")));

const discs = JSON.parse(fs.readFileSync(path.join(__dirname, "../discs.json"), "utf8"));
const byId = new Map(discs.discs.map((disc) => [disc.id, disc]));
Object.entries(file.albums).forEach(([id, themes]) => {
  assert.ok(byId.has(id), id);
  themes.forEach((theme) => assert.ok(file.themes.includes(theme), theme));
});
Object.entries(file.tracks).forEach(([id, tracks]) => {
  const disc = byId.get(id);
  assert.ok(disc, id);
  Object.keys(tracks).forEach((n) => {
    assert.ok(disc.tracks.some((track) => String(track.n) === n), id + " " + n);
    tracks[n].forEach((theme) => assert.ok(file.themes.includes(theme)));
  });
});

assert.deepStrictEqual(Q.themesFor([{ discId: "oceans-of-light", n: 1 }], file), ["ocean", "light"]);
assert.deepStrictEqual(Q.themesFor([{ discId: "enlightenment", n: 5 }], file), ["enlightenment", "desert"]);
assert.deepStrictEqual(Q.themesFor([{ discId: "enlightenment", n: 3 }], file), ["enlightenment", "ocean"]);
assert.deepStrictEqual(Q.themesFor([{ discId: "mystery-school", n: 1 }], file), []);
assert.deepStrictEqual(
  Q.themesFor([{ discId: "oceans-of-light", n: 2 }, { discId: "tantra", n: 15 }], file).sort(),
  ["light", "ocean", "tantric"].sort()
);

const realTalk = {
  id: "real-talk",
  title: "A recorded talk",
  kind: "talk",
  example: false,
  collection: "Dharma Talks",
  duration: 10,
  size: 1,
  source: "https://www.ramameditationsociety.org/meditation/",
  r2Key: "talks/real-talk.mp3",
};
const fixtureLine = "FIXTURE LINE ONE";
const otherLine = "FIXTURE LINE TWO";
const withTalks = talks.concat([
  realTalk,
  {
    id: "end-line",
    title: "End line",
    kind: "quote",
    example: false,
    text: fixtureLine,
    source: "https://www.ramameditationsociety.org/free-resource/balance/",
    themes: ["light", "nope", "light"],
    from: "real-talk",
  },
  {
    id: "example-link",
    title: "Unlinked",
    kind: "quote",
    example: false,
    text: otherLine,
    source: "https://www.ramameditationsociety.org/free-resource/balance/",
    themes: ["power"],
    from: "example-talk",
  },
  {
    id: "dup-line",
    title: "Duplicate",
    kind: "quote",
    example: false,
    text: file.quotes[0].text,
    source: file.quotes[0].source,
    from: "real-talk",
  },
]);
const mixed = Q.poolFrom(file, withTalks);
assert.strictEqual(mixed.length, 10);
const linked = mixed.find((quote) => quote.id === "end-line");
assert.strictEqual(linked.text, fixtureLine);
assert.strictEqual(linked.libraryId, "real-talk");
assert.strictEqual(linked.fromTitle, "A recorded talk");
assert.strictEqual(linked.source, "https://www.ramameditationsociety.org/free-resource/balance/");
assert.deepStrictEqual(linked.themes, ["light"]);
const unlinked = mixed.find((quote) => quote.id === "example-link");
assert.strictEqual(unlinked.libraryId, "");
assert.strictEqual(unlinked.fromTitle, "");
assert.deepStrictEqual(unlinked.themes, ["power"]);
assert.strictEqual(mixed.filter((quote) => quote.text === file.quotes[0].text).length, 1);
assert.ok(mixed.every((quote) => quote.text === fixtureLine || quote.text === otherLine || rama.some((row) => row[0] === quote.text)));

const passed = T.entry({
  id: "real-quote",
  title: "End line",
  kind: "quote",
  collection: "Dharma Talks",
  duration: 0,
  size: 0,
  source: "https://www.ramameditationsociety.org/meditation/",
  text: fixtureLine,
  themes: ["light", "Light", "light", "not a theme"],
  from: "real-talk",
});
assert.deepStrictEqual(passed.themes, ["light"]);
assert.strictEqual(passed.from, "real-talk");
assert.strictEqual(JSON.stringify(T.view(passed)).includes("http"), false);
assert.strictEqual(T.entry(Object.assign({}, passed, { id: "real-quote", from: "real-quote" })).from, "");

const pair = [
  { id: "a", text: "one", themes: ["light"] },
  { id: "b", text: "two", themes: [] },
];
assert.strictEqual(Q.select(pair, { themes: ["light"] }, () => 0).id, "a");
assert.strictEqual(Q.select(pair, { themes: ["light"] }, () => 0.76).id, "b");
assert.strictEqual(Q.select([], { themes: ["light"] }, () => 0), null);
assert.strictEqual(Q.select(pool, { themes: ["light"], file }, () => 0).id, pool[0].id);

function lcg(seed) {
  let state = seed >>> 0;
  return function () {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function tally(options, draws, seed) {
  const rng = lcg(seed);
  const counts = {};
  for (let i = 0; i < draws; i++) {
    const chosen = Q.select(pool, options, rng);
    counts[chosen.id] = (counts[chosen.id] || 0) + 1;
  }
  return counts;
}

const light = tally({ tracks: [{ discId: "mandala-of-light", n: 1 }], file }, 600, 3);
const lightHits = pool.filter((quote) => quote.themes.includes("light")).reduce((sum, quote) => sum + light[quote.id], 0);
assert.ok(lightHits / 600 > 0.42 && lightHits / 600 < 0.62, String(lightHits));
assert.ok(lightHits < 600);
Object.values(light).forEach((count) => assert.ok(count / 600 < 0.7));

const even = tally({ tracks: [{ discId: "mystery-school", n: 1 }], file }, 800, 9);
pool.forEach((quote) => {
  const share = (even[quote.id] || 0) / 800;
  assert.ok(share > 0.05 && share < 0.3, quote.id + " " + share);
});

const sticky = pool[0].id;
const again = tally({ tracks: [{ discId: "mystery-school", n: 1 }], file, lastId: sticky }, 800, 9);
assert.ok((again[sticky] || 0) < (even[sticky] || 0));
assert.ok((again[sticky] || 0) / 800 < 0.09);

assert.ok(page.includes('id="done-from"'));
assert.ok(page.includes("YantraQuotes"));
assert.ok(page.includes("showRamaWords"));
const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const livePoll = web.slice(web.indexOf("async function livePoll"), web.indexOf("function listsKey"));
const completes = [...livePoll.matchAll(/complete\(\)/g)];
assert.strictEqual(completes.length, 3);
completes.forEach((match) => {
  const before = livePoll.slice(Math.max(0, match.index - 200), match.index);
  assert.ok(before.includes("noteSit()"));
  assert.ok(before.includes("liveStop(false)"));
  assert.ok(before.indexOf("noteSit()") < before.lastIndexOf("liveStop(false)"));
});
assert.ok(web.includes("window.yantraLastSit"));
const shell = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.ok(shell.indexOf("quotes.js") > 0 && shell.indexOf("quotes.js") < shell.indexOf("talks.js"));
assert.ok(fs.readFileSync(path.join(__dirname, "talks.js"), "utf8").includes("yantraOpenTalk"));

console.log("quotes.test.js ok");
