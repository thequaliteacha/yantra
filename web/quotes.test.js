/* node web/quotes.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Q = require("./quotes.js");
const T = require("./talks.js");

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const file = JSON.parse(fs.readFileSync(path.join(__dirname, "quotes.json"), "utf8"));
const discs = JSON.parse(fs.readFileSync(path.join(__dirname, "../discs.json"), "utf8"));
const talks = JSON.parse(fs.readFileSync(path.join(__dirname, "talks.json"), "utf8"));
const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");

const VERBATIM = [
  ["It’s a decision that you make every day and that you renew, that you strengthen. You decide to be happy.", "Balance", "https://www.ramameditationsociety.org/free-resource/balance/"],
  ["And the shortcut to happiness, to spiritual balance, is to meditate.", "Balance", "https://www.ramameditationsociety.org/free-resource/balance/"],
  ["Each time you meditate, you take the journey. Each time, you become more conscious, you love more, you feel more, you increase your depth.", "Enlightenment", "https://www.ramameditationsociety.org/free-resource/enlightenment-cycle-talk/"],
  ["Meditation is to stop thought, to silence the mind, to move the ego aside and to simply be still, open, clear, bright and fully conscious.", "Enlightenment", "https://www.ramameditationsociety.org/free-resource/enlightenment-cycle-talk/"],
  ["What makes us happy is contact with Light. As you have experiences with the inner light, which are gained through the practice of meditation and Buddhism, it immediately delights you.", "Personal Happiness", "https://www.ramameditationsociety.org/free-resource/personal-happiness/"],
  ["But the real miracle, obviously, is the transformation of consciousness from limitation and pain to enlightenment and ecstasy.", "Miracles", "https://www.ramameditationsociety.org/free-resource/miracles/"],
  ["In intermediate meditation, you’re touching light more deeply than in introductory meditation.", "Intermediate Meditation", "https://www.ramameditationsociety.org/free-resource/intermediate-meditation/"],
  ["As an enlightened teacher of Buddhism, I’d like to welcome you to the pathway to enlightenment.", "The Enlightenment Cycle", "https://www.ramameditationsociety.org/free-resource/enlightenment-cycle/"],
];

assert.strictEqual(file.quotes.length, VERBATIM.length);
file.quotes.forEach((quote, index) => {
  assert.strictEqual(quote.text, VERBATIM[index][0]);
  assert.strictEqual(quote.talk, VERBATIM[index][1]);
  assert.strictEqual(quote.href, VERBATIM[index][2]);
  assert.strictEqual(quote.by, "Rama");
  quote.themes.forEach((theme) => {
    assert.ok(file.themes.includes(theme), theme);
    assert.ok(quote.text.toLowerCase().includes(theme), quote.talk + " " + theme);
  });
});

const pool = Q.pool(file);
assert.strictEqual(pool.length, 8);
assert.ok(pool.every((quote) => VERBATIM.some((row) => row[0] === quote.text)));
assert.ok(pool.every((quote) => quote.href.startsWith("https://www.ramameditationsociety.org/")));

const byId = new Map(discs.discs.map((disc) => [disc.id, disc]));
Object.entries(file.albums).forEach(([id, themes]) => {
  assert.ok(byId.has(id), id);
  themes.forEach((theme) => assert.ok(file.themes.includes(theme), theme));
});
Object.entries(file.tracks).forEach(([id, tagged]) => {
  const disc = byId.get(id);
  assert.ok(disc, id);
  Object.keys(tagged).forEach((n) => {
    assert.ok(disc.tracks.some((track) => String(track.n) === n), id + " " + n);
    tagged[n].forEach((theme) => assert.ok(file.themes.includes(theme)));
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

VERBATIM.forEach((row) => {
  const found = T.findTalk(talks, "zazen", row[1]);
  assert.ok(found, row[1]);
  assert.strictEqual(found.title, row[1]);
  assert.ok(found.src.startsWith("/talks/"), found.src);
  assert.strictEqual(T.findTalk(talks, "sangha", row[1]), null);
  assert.strictEqual(T.findTalk(talks, "", row[1]), null);
});
assert.strictEqual(T.findTalk(talks, "zazen", "Not a talk"), null);
assert.strictEqual(T.findTalk(talks, "zazen", "intermediate meditation").title, "Intermediate Meditation");

const pair = [
  { id: "a", text: "one", themes: ["light"] },
  { id: "b", text: "two", themes: [] },
];
assert.strictEqual(Q.select(pair, { themes: ["light"] }, () => 0).id, "a");
assert.strictEqual(Q.select(pair, { themes: ["light"] }, () => 0.76).id, "b");
assert.strictEqual(Q.select([], { themes: ["light"] }, () => 0), null);

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

const desert = Q.select(pool, { tracks: [{ discId: "anza-borrego", n: 1 }], file }, () => 0);
assert.ok(!desert.themes.includes("desert"), "a desert album does not invent a desert quote");
assert.ok(VERBATIM.some((row) => row[0] === desert.text));

assert.ok(page.includes('id="done-from"'));
assert.ok(page.includes('id="done-words"'));
assert.ok(page.includes("YantraQuotes"));
assert.ok(page.includes('window.YANTRA_LEVEL === "zazen" ? window.yantraQuoteFile : null'));
assert.ok(page.includes('from.textContent = "From: " + talk.title'));
assert.ok(page.includes('if (window.YANTRA_LEVEL !== "zazen") return;'));
assert.ok(page.includes('showRoom("talks");'));
assert.strictEqual(page.includes("You decide to be happy"), false);
assert.strictEqual(page.includes("ramameditationsociety.org"), false);

const livePoll = web.slice(web.indexOf("async function livePoll"), web.indexOf("function listsKey"));
const completes = [...livePoll.matchAll(/complete\(\)/g)];
assert.strictEqual(completes.length, 3);
completes.forEach((match) => {
  const before = livePoll.slice(Math.max(0, match.index - 220), match.index);
  assert.ok(before.includes("noteSit()"), before);
  assert.ok(before.includes("liveStop(false)"));
  assert.ok(before.indexOf("noteSit()") < before.lastIndexOf("liveStop(false)"));
});
assert.ok(web.includes("window.yantraLastSit"));
assert.ok(web.includes('level === "zazen"'));
assert.ok(web.includes("window.yantraQuoteFile = null"));
assert.ok(shell.indexOf("quotes.js") > 0 && shell.indexOf("quotes.js") < shell.indexOf("talks.js"));
assert.ok(account.includes('window.YANTRA_LEVEL = level'));
assert.ok(account.includes("window.yantraQuoteFile = null"));

const section = {
  querySelector(sel) {
    if (sel === "audio") return this.audio;
    if (sel === "[data-talk-now]") return this.now;
    return null;
  },
  audio: {
    hidden: true,
    attrs: {},
    played: 0,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    play() { this.played += 1; return Promise.resolve(); },
  },
  now: { textContent: "" },
};
const balance = T.findTalk(talks, "zazen", "Balance");
assert.strictEqual(T.play(section, balance.src, balance.title), true);
assert.strictEqual(section.audio.attrs.src, balance.src);
assert.strictEqual(section.audio.played, 1);
assert.strictEqual(section.now.textContent, "Balance");
assert.strictEqual(T.play(section, "https://example.invalid/talk.mp3", "Balance"), false);
assert.strictEqual(T.play(section, "/talks/../secret.mp3", "Balance"), false);

console.log("quotes.test.js ok");
