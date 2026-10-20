/* node web/playback.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const P = require("./playback.js");

const audio = JSON.parse(fs.readFileSync(path.join(__dirname, "audio.json"), "utf8"));
const tracks = JSON.parse(fs.readFileSync(path.join(__dirname, "tracks.json"), "utf8"));
const discs = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "discs.json"), "utf8"));
const page = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function discById(id) {
  return discs.discs.find((disc) => disc.id === id);
}

function asTrack(disc, n) {
  const row = (tracks[disc.id] || {})[String(n)] || {};
  return {
    discId: disc.id,
    n: n,
    circle: disc.circle,
    title: (disc.tracks.find((track) => track.n === n) || {}).title || "",
    hosted: !!(audio[disc.id] && audio[disc.id][String(n)]),
    spotify: !!row.spotify,
    key: disc.id + "#" + n,
  };
}

const india = discById("india-dream");
const awake = discById("awake-in-anza-borrego");
const maha = asTrack(india, 3);
const gems = asTrack(awake, 2);
const samurai = asTrack(discById("samurai"), 1);

assert.strictEqual(maha.title, "Maha Ananda Siddha");
assert.strictEqual(maha.hosted, false);
assert.strictEqual(audio["india-dream"], undefined);
assert.ok(tracks["india-dream"]["3"].spotify.endsWith("/0RI5N9YrgI8HdDUrPTRTlO"));
assert.strictEqual(india.circle, "vayu");

assert.strictEqual(gems.title, "Stream of Gems (feat. AgniKala)");
assert.strictEqual(gems.hosted, false);
assert.strictEqual(awake.circle, "lumikara");
assert.strictEqual(audio["awake-in-anza-borrego"], undefined);
assert.ok(tracks["awake-in-anza-borrego"]["2"].spotify.endsWith("/0Ky6ZKrevXPFJH2iZZBjC7"));
assert.strictEqual(samurai.hosted, true);

const phone = { sdk: false, connected: true, blocked: false, failed: false, handset: false, failedKeys: {} };
const handset = { sdk: false, connected: true, blocked: false, failed: false, handset: true, failedKeys: {} };
const desktop = { sdk: true, connected: true, blocked: false, failed: false, handset: true, failedKeys: {} };

assert.strictEqual(P.spotifySdkSupported({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/129.0.0.0 Mobile", maxTouchPoints: 5 }), false);
assert.strictEqual(P.spotifySdkSupported({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", maxTouchPoints: 0 }), true);
assert.strictEqual(P.spotifySdkSupported({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 }), false);

assert.strictEqual(P.trackOffered(maha, phone), false, "India Dream is Spotify-only and silent without a handset");
assert.strictEqual(P.trackOffered(gems, phone), false);
assert.strictEqual(P.trackOffered(gems, desktop), false, "Lumikara stays out even when Spotify works");
assert.strictEqual(P.trackOffered(gems, handset), false);
assert.strictEqual(P.trackOffered(maha, desktop), true);
assert.strictEqual(P.trackOffered(maha, handset), true);
assert.strictEqual(P.trackOffered(samurai, phone), true, "a hosted file still plays on a phone");

const failed = Object.assign({}, desktop, { failedKeys: { "india-dream#3": true } });
assert.strictEqual(P.trackOffered(maha, failed), false, "a song that already failed this session is not offered again");

const offline = Object.assign({}, desktop, { connected: false });
assert.strictEqual(P.trackOffered(maha, offline), false);
const blocked = Object.assign({}, desktop, { blocked: true });
assert.strictEqual(P.trackOffered(maha, blocked), false);

const lumikara = discs.discs.filter((disc) => disc.circle === "lumikara");
assert.ok(lumikara.length >= 3);
for (const disc of lumikara) {
  assert.strictEqual(audio[disc.id], undefined, disc.id + " is not in the R2 manifest");
  for (const track of disc.tracks) {
    assert.strictEqual(P.trackOffered(asTrack(disc, track.n), desktop), false, disc.id + " #" + track.n);
  }
}

const offered = P.filterDiscs(discs.discs.map((disc) => Object.assign({}, disc, {
  tracks: disc.tracks.map((track) => asTrack(disc, track.n)),
})), phone);
assert.ok(offered.every((disc) => disc.circle !== "lumikara"));
assert.ok(!offered.some((disc) => disc.id === "india-dream"));
assert.ok(offered.some((disc) => disc.id === "samurai"));
assert.ok(offered.find((disc) => disc.id === "samurai").tracks.some((track) => track.n === 1));

const desktopList = P.filterDiscs(discs.discs.map((disc) => Object.assign({}, disc, {
  tracks: disc.tracks.map((track) => asTrack(disc, track.n)),
})), desktop);
assert.ok(desktopList.some((disc) => disc.id === "india-dream"));
assert.ok(desktopList.find((disc) => disc.id === "india-dream").tracks.some((track) => track.title === "Maha Ananda Siddha"));
assert.ok(!desktopList.some((disc) => disc.circle === "lumikara"));

const watch = P.createProgressWatch(5000);
assert.deepStrictEqual(watch.sample("spotify:track:maha", 0, true, 1000), { stalled: false, moved: false });
assert.deepStrictEqual(watch.sample("spotify:track:maha", 0, true, 4000), { stalled: false, moved: false });
assert.deepStrictEqual(watch.sample("spotify:track:maha", 0, true, 6000), { stalled: true, moved: false });
const playing = P.presentState({ playing: true, position: 0 }, { stalled: true, moved: false });
assert.notStrictEqual(playing.status, "Playing");
assert.strictEqual(playing.moving, false);

const moving = P.createProgressWatch(5000);
moving.sample("audio/samurai/01.mp3", 0, true, 0);
const step = moving.sample("audio/samurai/01.mp3", 1.2, true, 1200);
assert.deepStrictEqual(step, { stalled: false, moved: true });
assert.deepStrictEqual(P.presentState({ playing: true, position: 1.2 }, step), { status: "Playing", moving: true });

assert.strictEqual(P.classifyPlayback({ rejected: true }), "rejected");
assert.strictEqual(P.classifyPlayback({ error: true }), "error");
assert.strictEqual(P.classifyPlayback({ stalled: true, sinceProgress: 1000 }), "");
assert.strictEqual(P.classifyPlayback({ stalled: true, sinceProgress: 5000 }), "stall");
assert.strictEqual(P.classifyPlayback({ quiet: true, sinceProgress: 5000 }), "stall");

const queue = [
  { key: "a", playable: false },
  { key: "b", playable: false },
  { key: "c", playable: true },
];
assert.strictEqual(P.nextPlayable(queue, 0, (item) => item.playable), 2);
assert.strictEqual(P.nextPlayable(queue, 2, (item) => item.playable), -1);
assert.strictEqual(P.calmLine(true), "This song didn't play. The next one is starting.");
assert.strictEqual(P.calmLine(false), "This song didn't play.");

assert.strictEqual(page.includes("ramameditationsociety.org"), false);
assert.strictEqual(page.includes("You decide to be happy"), false);
assert.strictEqual(page.includes("RAMA_WORDS"), false);
assert.ok(page.includes('id="done-words"'));
assert.ok(page.includes("YANTRA_LEVEL"));
assert.ok(page.includes("z-index: 6"));
assert.ok(fs.readFileSync(path.join(__dirname, "index.html"), "utf8").includes('src="playback.js"'));

const quotes = JSON.parse(fs.readFileSync(path.join(__dirname, "quotes.json"), "utf8"));
assert.ok(quotes.some((row) => row.text.includes("You decide to be happy") && row.href.includes("/balance/")));
assert.ok(quotes.every((row) => row.by === "Rama" && row.href && row.talk && row.text));

console.log("playback.test.js ok");
