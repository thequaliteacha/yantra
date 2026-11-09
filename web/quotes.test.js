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
  ["Wisdom is the ability to do two things at once — to be in the world and of it, to enjoy it, to participate in it fully and successfully, and at the same time, to not be here at all — to be in realms of light, to be in samadhi, beyond all this. That’s true wisdom.", "Wisdom", "https://www.ramameditationsociety.org/free-resource/wisdom/"],
  ["Meditation is the science of stopping thought. When there is no thought, there is only pure mind – which is ecstasy. Meditation is perfect, qualityless, clear light perceiving itself as such.", "Awareness of Meditation", "https://www.ramameditationsociety.org/free-resource/awareness-meditation/"],
  ["Meditation is timeless awareness. You don’t have to do anything to make it happen. You don’t have to rub two sticks together vigorously to create fire. The fire is already burning inside.", "Non-Doing of Meditation", "https://www.ramameditationsociety.org/free-resource/non-doing-meditation/"],
  ["Your thoughts are like birds. Birds come into the sky and we see them. Then they fly by and they’re gone, but the sky, which is the element through which they travel, remains the same. The sky was there before the birds came; it was there while they passed through, and while they left. We want to find ourselves. We are the sky.", "Introductory and Intermediate Meditation", "https://www.ramameditationsociety.org/free-resource/introductory-and-intermediate-meditation/"],
  ["When you concentrate, you’re focusing on something. When you meditate, you’re letting go and dissolving, you’re seeking to stop all thought.", "Zazen: Concentration and Meditation", "https://www.ramameditationsociety.org/free-resource/zazen-concentration-and-meditation/"],
  ["As you focus completely on something, all other thoughts will be forced out of the mind because your attention will be dominated by the object of concentration. This develops your mental power exquisitely.", "Zazen: Concentration and Meditation", "https://www.ramameditationsociety.org/free-resource/zazen-concentration-and-meditation/"],
  ["In advanced meditation, you become light. You transcend self, ego, time, space, dimensionality. You merge with the clear light of reality and you go beyond this world.", "Intermediate Meditation", "https://www.ramameditationsociety.org/free-resource/intermediate-meditation/"],
  ["Meditation is concentration in the beginning. It’s a focus. Then, in the intermediate stage, it’s an opening, a deepening of one’s awareness but with a focus towards the planes of light.", "Intermediate Meditation", "https://www.ramameditationsociety.org/free-resource/intermediate-meditation/"],
  ["Beyond duality, there is no darkness, no evil. There is only light: white light and black light (like the light between the stars).", "Light", "https://www.ramameditationsociety.org/free-resource/light/"],
  ["If you focus on light exclusively, then you will experience ecstasy!", "Light", "https://www.ramameditationsociety.org/free-resource/light/"],
  ["Enlightenment is the complete awareness of life without mental modifications. Enlightenment is the state of awareness we reach when our consciousness is one with infinity, with the infinite consciousness of life itself. Enlightenment is not a state of mind, although all states of mind are contained within it. It is the best of all things, the brightest of all lights.", "Enlightenment", "https://www.ramameditationsociety.org/enlightenment-from-the-enlightenment-cycle-talks-by-rama/"],
  ["Enlightenment is happiness – happiness in the most profound and yet most simple sense. Enlightenment is, as I said before, a journey – a journey into cosmic consciousness. And meditation is the key to enlightenment.", "Enlightenment", "https://www.ramameditationsociety.org/enlightenment-from-the-enlightenment-cycle-talks-by-rama/"],
  ["So enlightenment is a journey, a journey into light, a journey into self-knowledge, a journey into beauty, reflection, awareness.", "Enlightenment", "https://www.ramameditationsociety.org/enlightenment-from-the-enlightenment-cycle-talks-by-rama/"],
  ["At the beginning and the middle and the end of all things, there’s only perfection. And that’s the perfection of enlightenment that is nirvana.", "Enlightenment", "https://www.ramameditationsociety.org/enlightenment-from-the-enlightenment-cycle-talks-by-rama/"],
  ["Buddhism is the study of light and the study of life.", "Buddhism", "https://www.ramameditationsociety.org/free-resource/buddhism/"],
  ["Zen is the study of making the mind still. As your mind becomes still, a power enters into you. This power transforms your mind.", "Rapid Mental Development", "https://www.ramameditationsociety.org/free-resource/rapid-mental-development/"],
];

/* A theme tag has to be the word itself. "Enlightenment" contains the letters of "light" and is not a light tag. */
function saysTheme(text, theme) {
  return new RegExp("\\b" + theme + "s?\\b", "i").test(text);
}

assert.strictEqual(file.quotes.length, 24);
assert.strictEqual(file.quotes.length, VERBATIM.length);
assert.strictEqual(new Set(file.quotes.map((quote) => quote.text)).size, file.quotes.length);
file.quotes.forEach((quote, index) => {
  assert.strictEqual(quote.text, VERBATIM[index][0]);
  assert.strictEqual(quote.talk, VERBATIM[index][1]);
  assert.strictEqual(quote.href, VERBATIM[index][2]);
  assert.strictEqual(quote.by, "Rama");
  quote.themes.forEach((theme) => {
    assert.ok(file.themes.includes(theme), theme);
    assert.ok(saysTheme(quote.text, theme), quote.talk + " " + theme);
  });
});

const pool = Q.pool(file);
assert.strictEqual(pool.length, 24);
assert.strictEqual(new Set(pool.map((quote) => quote.id)).size, pool.length);
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

const catalog = new Set();
talks.sets.forEach((set) => set.talks.forEach((talk) => catalog.add(talk.title.toLowerCase())));
VERBATIM.forEach((row) => {
  const found = T.findTalk(talks, "zazen", row[1]);
  if (catalog.has(row[1].toLowerCase())) {
    assert.ok(found, row[1]);
    assert.strictEqual(found.title, row[1]);
    assert.ok(found.src.startsWith("/talks/"), found.src);
  } else {
    assert.strictEqual(found, null, row[1]);
  }
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

const TOUCHING = "In intermediate meditation, you’re touching light more deeply than in introductory meditation.";
const lightQuotes = pool.filter((quote) => quote.themes.includes("light"));
const lightTalks = new Set(lightQuotes.map((quote) => quote.talk));
const touching = pool.find((quote) => quote.text === TOUCHING);
assert.ok(touching.themes.includes("light"));
assert.ok(lightQuotes.length >= 8, String(lightQuotes.length));
assert.ok(lightTalks.size >= 6, [...lightTalks].join(", "));
assert.ok(lightQuotes.filter((quote) => quote.text !== TOUCHING).length >= 7);
const intermediateLight = pool.filter((quote) => quote.talk === "Intermediate Meditation" && quote.themes.includes("light"));
assert.ok(intermediateLight.length >= 3, String(intermediateLight.length));

const lightDraws = 3000;
const light = tally({ tracks: [{ discId: "mandala-of-light", n: 1 }], file }, lightDraws, 3);
const lightHits = lightQuotes.reduce((sum, quote) => sum + (light[quote.id] || 0), 0);
assert.ok(lightHits / lightDraws > 0.64 && lightHits / lightDraws < 0.8, String(lightHits / lightDraws));
assert.ok(lightHits < lightDraws);
const touchingHits = light[touching.id] || 0;
assert.ok(touchingHits / lightDraws < 0.12, String(touchingHits / lightDraws));
assert.ok(touchingHits / lightHits < 0.2, String(touchingHits / lightHits));
Object.entries(light).forEach(([id, count]) => assert.ok(count / lightDraws < 0.12, id + " " + count / lightDraws));
const lightAvg = lightHits / lightQuotes.length;
const otherAvg = (lightDraws - lightHits) / (pool.length - lightQuotes.length);
assert.ok(lightAvg / otherAvg > 2.4 && lightAvg / otherAvg < 3.6, String(lightAvg / otherAvg));

const againLight = tally({ tracks: [{ discId: "mandala-of-light", n: 1 }], file, lastId: touching.id }, lightDraws, 11);
assert.ok((againLight[touching.id] || 0) / lightDraws < 0.05, String((againLight[touching.id] || 0) / lightDraws));
const otherLightPeak = Math.max(...lightQuotes.filter((quote) => quote.id !== touching.id).map((quote) => againLight[quote.id] || 0));
assert.ok((againLight[touching.id] || 0) < otherLightPeak);

const evenDraws = 2400;
const even = tally({ tracks: [{ discId: "mystery-school", n: 1 }], file }, evenDraws, 9);
pool.forEach((quote) => {
  const share = (even[quote.id] || 0) / evenDraws;
  assert.ok(share > 0.02 && share < 0.08, quote.id + " " + share);
});

const sticky = pool[0].id;
const again = tally({ tracks: [{ discId: "mystery-school", n: 1 }], file, lastId: sticky }, evenDraws, 9);
assert.ok((again[sticky] || 0) < (even[sticky] || 0));
assert.ok((again[sticky] || 0) / evenDraws < 0.04);

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

const closeSit = web.slice(web.indexOf("function closeSit"), web.indexOf("function serviceFor"));
assert.strictEqual([...closeSit.matchAll(/complete\(\)/g)].length, 1, "a sit finishes through one completion");
assert.ok(closeSit.indexOf("noteSit()") < closeSit.indexOf("liveStop(false)"));
assert.ok(closeSit.indexOf("liveStop(false)") < closeSit.indexOf("complete()"));
const livePoll = web.slice(web.indexOf("async function livePoll"), web.indexOf("function listsKey"));
assert.ok(!livePoll.includes("complete()"), "the poll does not complete a sit on its own");
assert.ok(livePoll.includes("closeSit()"));
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
