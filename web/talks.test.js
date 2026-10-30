/* node web/talks.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const T = require("./talks.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "talks.json"), "utf8"));
const page = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");

// The hosted sets, in order, each talk with an R2 key the Worker accepts.
assert.deepStrictEqual(data.sets.map((set) => set.title), ["Dharma Talks", "Rama Live LA", "The Enlightenment Cycle"]);
assert.deepStrictEqual(data.sets.map((set) => set.talks.length), [4, 6, 12]);
for (const set of data.sets) {
  for (const talk of set.talks) {
    assert.ok(/^talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/.test(talk.key), talk.key);
    assert.ok(talk.seconds > 60, talk.key + " has a length");
  }
}

// Zazen sees every set, grouped; Sangha and no level see nothing.
const zazen = T.talkSections(data, "zazen");
assert.deepStrictEqual(zazen.map((set) => set.id), ["dharma-talks", "rama-live-la", "the-enlightenment-cycle"]);
assert.strictEqual(zazen[1].talks[1].src, "/talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3");
assert.strictEqual(zazen[1].talks[1].title, "Cosmic Awareness");
assert.deepStrictEqual(T.talkSections(data, "sangha"), []);
assert.deepStrictEqual(T.talkSections(data, ""), []);
assert.deepStrictEqual(T.talkSections(null, "zazen"), []);

assert.strictEqual(T.talkSrc("talks/../secret.mp3"), "");
assert.strictEqual(T.talkSrc("big-island/01.mp3"), "");
assert.strictEqual(T.formatLength(1797), "30 min");
assert.strictEqual(T.formatLength(3557), "59 min");
assert.strictEqual(T.formatLength(7395), "2 hr 3 min");

// A tiny DOM, enough for render().
function el(tag) {
  return {
    tag, children: [], attrs: {}, hidden: false, textContent: "", listeners: {},
    append(...kids) { this.children.push(...kids); },
    replaceChildren() { this.children = []; },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
}
function section() {
  const list = el("div"), now = el("p"), audio = el("audio");
  audio.hidden = true;
  audio.played = 0;
  audio.play = function () { this.played += 1; return Promise.resolve(); };
  audio.pause = function () {};
  const doc = { createElement: el };
  const root = el("div");
  root.hidden = true;
  root.ownerDocument = doc;
  const head = el("h3"), note = el("p");
  root.querySelector = (sel) => ({ "[data-talk-list]": list, "[data-talk-now]": now, "[data-talk-head]": head, "[data-talk-note]": note, audio })[sel];
  return { root, list, now, audio, doc, head };
}

const forZazen = section();
assert.strictEqual(T.render(forZazen.root, data, "zazen"), true);
assert.strictEqual(forZazen.root.hidden, false, "the talks section shows for the Zazen word");
assert.strictEqual(forZazen.list.children.length, 3);
assert.strictEqual(forZazen.head.textContent, "Dharma Talks by Rama");
const liveLa = forZazen.list.children[1];
assert.strictEqual(liveLa.children[0].textContent, "Rama Live LA");
liveLa.children[2].listeners.click();
assert.strictEqual(forZazen.audio.attrs.src, "/talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3");
assert.strictEqual(forZazen.audio.hidden, false);
assert.strictEqual(forZazen.audio.played, 1);
assert.strictEqual(forZazen.now.textContent, "Rama Live LA \u00b7 Cosmic Awareness");

const forSangha = section();
assert.strictEqual(T.render(forSangha.root, data, "sangha"), false);
assert.strictEqual(forSangha.root.hidden, true, "the talks section stays hidden for the Sangha word");
assert.strictEqual(forSangha.list.children.length, 0);

// The page carries the section, loads talks.js, and checks the level itself.
assert.ok(page.includes('id="talks-list" hidden'));
assert.ok(page.includes('<summary id="account-title">Mindfulness Material</summary>'));
assert.ok(page.includes('id="open-talks" data-room="talks" hidden'));
assert.strictEqual(page.includes('id="account-mindful" hidden'), false, "Albums stay when talks are hidden");
assert.ok(page.includes(">Start Here<"));
assert.strictEqual(page.includes("Sit Guidance"), false);
assert.ok(page.includes("talks.hidden = !shown"));
assert.ok(!/Rama|Frederick Lenz/.test(page), "the shared page carries no Rama text for the Sangha word");
assert.ok(page.includes('window.YANTRA_LEVEL !== "zazen"'));
assert.ok(loader.includes('src="talks.js"'));
assert.ok(loader.includes('src="listening.js"'));
assert.strictEqual(fs.readFileSync(path.join(__dirname, "talks.js"), "utf8").includes("YantraPractice"), false);
assert.ok(sw.includes('"/talks.json"'), "the service worker never caches the talk list");
assert.ok(page.includes("z-index: 6"), "the back arrow stays above the room");

console.log("talks.test.js ok");

// A talk keeps its place: pausing saves where it was, finishing marks it heard, and the
// next start picks up there. Stored with the other settings on this device.
{
  const store = {};
  globalThis.YantraSettings = {
    get: (key) => (key === "talks.progress" ? JSON.parse(JSON.stringify(store.progress || {})) : undefined),
    set: (key, value) => { if (key === "talks.progress") store.progress = value; },
  };
  const handlers = {};
  const player = {
    attrs: {}, currentTime: 0, duration: 1800, hidden: true,
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    removeEventListener(name, fn) { handlers[name] = (handlers[name] || []).filter((f) => f !== fn); },
    play() { return Promise.resolve(); },
    pause() {},
  };
  const fire = (name) => (handlers[name] || []).slice().forEach((fn) => fn());
  const section = { querySelector: (sel) => (sel === "audio" ? player : null) };
  assert.ok(T.play(section, "/talks/meditation.mp3", "Meditation"));
  player.currentTime = 640;
  fire("pause");
  assert.deepStrictEqual(store.progress["/talks/meditation.mp3"], { at: 640, done: false });
  assert.strictEqual(T.stateLabel("30 min", 0, store.progress["/talks/meditation.mp3"]), "11 min of 30 min");
  // A fresh start resumes there.
  player.attrs = {};
  player.currentTime = 0;
  T.play(section, "/talks/meditation.mp3", "Meditation");
  fire("loadedmetadata");
  assert.strictEqual(player.currentTime, 640);
  fire("ended");
  assert.deepStrictEqual(store.progress["/talks/meditation.mp3"], { at: 0, done: true });
  assert.strictEqual(T.stateLabel("30 min", 0, store.progress["/talks/meditation.mp3"]), "✓ 30 min");
  delete globalThis.YantraSettings;
}
console.log("talks progress ok");

{
  const seen = [];
  globalThis.YantraListening = {
    observeTalk(sample) { seen.push(sample); },
    endTalk() { seen.push("end"); },
    talkLine() { return ""; },
  };
  const practice = { commits: 0 };
  globalThis.YantraPractice = { commit() { practice.commits += 1; } };
  const handlers = {};
  const player = {
    attrs: {}, currentTime: 0, duration: 1800, hidden: true, paused: false,
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    removeEventListener(name, fn) { handlers[name] = (handlers[name] || []).filter((f) => f !== fn); },
    play() { return Promise.resolve(); },
    pause() { this.paused = true; },
  };
  const fire = (name) => (handlers[name] || []).slice().forEach((fn) => fn());
  const section = { querySelector: (sel) => (sel === "audio" ? player : null) };
  assert.ok(T.play(section, "/talks/meditation.mp3", "Meditation"));
  player.currentTime = 70;
  fire("timeupdate");
  player.currentTime = 140;
  player.paused = true;
  fire("pause");
  assert.ok(seen.some((sample) => sample && sample.key === "/talks/meditation.mp3" && sample.position === 70));
  assert.ok(seen.includes("end"));
  assert.strictEqual(practice.commits, 0, "a talk does not commit a formal sit");
  delete globalThis.YantraListening;
  delete globalThis.YantraPractice;
}
console.log("talks listening ok");
