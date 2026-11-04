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
assert.ok(sw.includes("isTalkAudio"), "a kept talk is served from the audio cache");
assert.strictEqual(sw.includes('"/web/talks.json"'), false);
assert.ok(page.includes("z-index: 6"), "the back arrow stays above the room");
assert.ok(page.includes("talk-keep"), "a kept talk has a quiet control");
assert.ok(page.includes("talkCreditPlayable"), "an uncached talk is not offered offline from a quote");
assert.ok(fs.readFileSync(path.join(__dirname, "web.js"), "utf8").includes("yantraTalkKeep"));
assert.ok(fs.readFileSync(path.join(__dirname, "account.js"), "utf8").includes("clearTalks"));

const meditation = "/talks/meditation.mp3";
const keptOne = new Set([meditation]);
const online = T.talkSections(data, "zazen", { offline: false, kept: keptOne });
assert.strictEqual(online[1].talks.length, 6, "online, every talk still streams");
const plane = T.talkSections(data, "zazen", { offline: true, kept: keptOne });
assert.deepStrictEqual(plane.map((set) => set.id), ["dharma-talks", "the-enlightenment-cycle"]);
assert.deepStrictEqual(plane[0].talks.map((talk) => talk.src), [meditation]);
assert.ok(!JSON.stringify(plane).includes("Cosmic Awareness"), "an uncached talk is absent offline");
assert.deepStrictEqual(T.talkSections(data, "sangha", { offline: false, kept: keptOne }), []);
assert.strictEqual(T.canPlay(meditation, { offline: true, kept: keptOne }), true);
assert.strictEqual(T.canPlay("/talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3", { offline: true, kept: keptOne }), false);
assert.strictEqual(T.canPlay(meditation, { offline: false, kept: new Set() }), true);
assert.strictEqual(T.canPlay("/talks/../secret.mp3", { offline: false }), false);

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

{
  globalThis.YantraOffline = require("./offline.js");
  const actions = [];
  const kept = section();
  const src = "/talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3";
  assert.strictEqual(T.render(kept.root, data, "zazen", null, {
    offline: false,
    kept: new Set(),
    states: {},
    onAction: (talkSrc, action) => actions.push([talkSrc, action]),
  }), true);
  const live = kept.list.children[1];
  const row = live.children[2];
  assert.strictEqual(row.className, "talk-row");
  assert.strictEqual(row.children[0].className, "talk");
  const keep = row.children[1];
  assert.strictEqual(keep.className, "talk-keep");
  const button = keep.children.find((node) => node.tag === "button");
  assert.strictEqual(button.textContent, "Keep offline");
  button.listeners.click();
  assert.deepStrictEqual(actions, [[src, "Keep offline"]]);
  assert.strictEqual(kept.audio.played, 0, "keeping a talk does not start it");
  row.children[0].listeners.click();
  assert.strictEqual(kept.audio.played, 1);
  assert.strictEqual(kept.audio.attrs.src, src);

  const again = section();
  assert.strictEqual(T.render(again.root, data, "zazen", null, {
    offline: true,
    kept: new Set([src]),
    states: { [src]: { complete: true, bytes: 12 * 1024 * 1024, busy: false, error: false } },
    onAction: (talkSrc, action) => actions.push([talkSrc, action]),
  }), true);
  const titles = [];
  again.list.children.forEach((group) => {
    group.children.forEach((node) => {
      const talk = node.className === "talk-row" ? node.children[0] : node;
      if (talk && talk.className === "talk") titles.push(talk.children[0].textContent);
    });
  });
  assert.deepStrictEqual(titles, ["Cosmic Awareness"]);
  const keptRow = again.list.children[0].children[1].children[1];
  assert.strictEqual(keptRow.className, "talk-keep");
  assert.ok(keptRow.children[0].textContent.startsWith("On this device"));
  const remove = keptRow.children.find((node) => node.tag === "button");
  assert.strictEqual(remove.textContent, "Remove");
  assert.ok(!JSON.stringify(again.list).includes("Meditation"), "offline drops talks that are not on the device");

  const sanghaKeep = section();
  assert.strictEqual(T.render(sanghaKeep.root, data, "sangha", null, {
    onAction: () => actions.push("sangha"),
  }), false);
  assert.strictEqual(sanghaKeep.root.hidden, true);
  assert.strictEqual(actions.includes("sangha"), false);
  delete globalThis.YantraOffline;
}
console.log("talks offline ok");

// Leaving the visualizer: timeupdate may never fire once the talks page is
// hidden. Pause, continue, and resume still follow the audio element.
{
  const mem = new Map();
  global.localStorage = {
    getItem(key) { return mem.has(key) ? mem.get(key) : null; },
    setItem(key, value) { mem.set(String(key), String(value)); },
    removeItem(key) { mem.delete(key); },
  };
  const L = require("./listening.js");
  globalThis.YantraListening = L;
  const progress = {};
  globalThis.YantraSettings = {
    get: (key) => (key === "talks.progress" ? JSON.parse(JSON.stringify(progress.value || {})) : undefined),
    set: (key, value) => { if (key === "talks.progress") progress.value = value; },
  };
  const practice = { commits: 0 };
  globalThis.YantraPractice = { commit() { practice.commits += 1; } };
  const handlers = {};
  const player = {
    attrs: {}, currentTime: 0, duration: 1800, hidden: true, paused: false, ended: false,
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
  const src = "/talks/meditation.mp3";
  assert.ok(T.play(section, src, "Meditation"));
  assert.strictEqual(typeof handlers.play, "object");
  assert.strictEqual(typeof handlers.seeked, "object");
  // No timeupdate: the visualizer is closed and the element is not on screen.
  player.currentTime = 0;
  player.paused = false;
  L.pulseTalk(0);
  player.currentTime = 40;
  L.pulseTalk(40000);
  assert.ok(L.load().talks[src].ms >= 39000, "listening accrues without a visualizer or timeupdate");
  assert.strictEqual(progress.value[src].at, 40, "resume position advances while the visualizer is closed");
  player.paused = true;
  fire("pause");
  const pausedMs = L.load().talks[src].ms;
  assert.ok(pausedMs >= 39000);
  L.pulseTalk(80000);
  assert.strictEqual(L.load().talks[src].ms, pausedMs, "pause outside the visualizer stops credit");
  player.paused = false;
  player.currentTime = 40;
  L.pulseTalk(80000);
  player.currentTime = 55;
  L.pulseTalk(95000);
  player.paused = true;
  fire("pause");
  assert.ok(L.load().talks[src].ms >= pausedMs + 14000, "resume continues from the playhead");
  assert.ok(L.load().talks[src].ms < pausedMs + 20000, "the paused gap is not credited");
  assert.strictEqual(progress.value[src].at, 55);
  assert.strictEqual(practice.commits, 0, "off-screen talk controls do not commit a formal sit");
  L.watchTalk(null);
  delete globalThis.YantraListening;
  delete globalThis.YantraSettings;
  delete globalThis.YantraPractice;
}
console.log("talks leave visualizer ok");
