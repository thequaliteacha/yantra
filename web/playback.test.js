/* node web/playback.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const P = require("./playback.js");
const Choose = require("./choose.js");

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
assert.strictEqual(P.trackOffered(gems, desktop), false, "Lumikara stays out without the Zazen word, even when Spotify works");
assert.strictEqual(P.trackOffered(gems, handset), false);
const zazenDesktop = Object.assign({}, desktop, { level: "zazen" });
const sanghaDesktop = Object.assign({}, desktop, { level: "sangha" });
const zazenPhone = Object.assign({}, phone, { level: "zazen" });
assert.strictEqual(P.trackOffered(gems, zazenDesktop), true, "Lumikara plays for the Zazen word where Spotify works");
assert.strictEqual(P.trackOffered(gems, sanghaDesktop), false, "Lumikara is never offered to the Sangha word");
assert.strictEqual(P.trackOffered(gems, zazenPhone), false, "a Spotify-only Lumikara song is still hidden on a phone");
assert.strictEqual(P.circleOpen("lumikara", "zazen"), true);
assert.strictEqual(P.circleOpen("lumikara", "sangha"), false);
assert.strictEqual(P.circleOpen("lumikara", ""), false);
assert.strictEqual(P.circleOpen("vayu", "sangha"), true);
assert.strictEqual(P.trackOffered(maha, desktop), true);
assert.strictEqual(P.trackOffered(maha, handset), false, "Spotify is pickable only where the SDK is supported and connected");
assert.strictEqual(P.spotifyUsable(handset), false);
assert.strictEqual(P.spotifyUsable(desktop), true);
assert.strictEqual(P.trackOffered(samurai, phone), true, "a hosted file still plays on a phone");
assert.strictEqual(P.circleOpen("zazen", "sangha"), false, "the Sangha word does not open Zazen");
assert.strictEqual(P.circleOpen("lineage", "sangha"), false);
assert.strictEqual(P.circleOpen("zazen", "zazen"), true);

const failed = Object.assign({}, desktop, { failedKeys: { "india-dream#3": true } });
assert.strictEqual(P.trackOffered(maha, failed), false, "a song that already failed this session is not offered again");

const offline = Object.assign({}, desktop, { connected: false });
assert.strictEqual(P.trackOffered(maha, offline), false);
const blocked = Object.assign({}, desktop, { blocked: true });
assert.strictEqual(P.trackOffered(maha, blocked), false);

const lumikara = discs.discs.filter((disc) => disc.circle === "lumikara");
assert.ok(lumikara.length >= 3);
for (const disc of lumikara) {
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

const zazenList = P.filterDiscs(discs.discs.map((disc) => Object.assign({}, disc, {
  tracks: disc.tracks.map((track) => asTrack(disc, track.n)),
})), zazenDesktop);
assert.ok(zazenList.some((disc) => disc.id === "awake-in-anza-borrego"), "Lumikara is in Zazen meditation lists");
assert.ok(zazenList.find((disc) => disc.id === "awake-in-anza-borrego").tracks.some((track) => track.title.startsWith("Stream of Gems")));
const sanghaList = P.filterDiscs(discs.discs.filter((disc) => disc.circle === "vayu").map((disc) => Object.assign({}, disc, {
  tracks: disc.tracks.map((track) => asTrack(disc, track.n)),
})), sanghaDesktop);
assert.ok(sanghaList.length > 0 && sanghaList.every((disc) => disc.circle === "vayu"));

function shaped(list) {
  return list.map((disc) => Object.assign({}, disc, {
    tracks: disc.tracks.map((track) => asTrack(disc, track.n)),
  }));
}
const catalog = shaped(discs.discs);
const circles = discs.circles;
const phoneShelf = P.filterDiscs(catalog, phone);
assert.ok(!phoneShelf.some((disc) => disc.id === "india-dream"), "a Spotify-only album is left off a phone");
assert.ok(!phoneShelf.some((disc) => disc.id === "breathless"));
assert.ok(!phoneShelf.some((disc) => disc.id === "samsara"));
assert.ok(phoneShelf.some((disc) => disc.id === "samurai"));
assert.ok(!phoneShelf.some((disc) => disc.circle === "lumikara"), "Lumikara stays hidden without the Zazen word");
const island = phoneShelf.find((disc) => disc.id === "big-island");
assert.ok(island, "a hosted album stays when one song cannot play");
assert.ok(island.tracks.some((track) => track.n === 1));
assert.ok(!island.tracks.some((track) => track.title === "Ocean Sunset"));

const zazenPhoneShelf = P.filterDiscs(catalog, zazenPhone);
assert.ok(!zazenPhoneShelf.some((disc) => disc.id === "awake-in-anza-borrego"), "a Spotify-only Lumikara album is hidden on a phone");
assert.ok(zazenPhoneShelf.some((disc) => disc.id === "samurai"));
const zazenSections = P.visibleCircles(circles, zazenPhoneShelf);
assert.ok(zazenSections.some((circle) => circle.id === "zazen"));
assert.ok(zazenSections.some((circle) => circle.id === "vayu"));
assert.ok(!zazenSections.some((circle) => circle.id === "lumikara"), "a section with nothing playable is hidden");

const sanghaPhoneShelf = P.filterDiscs(catalog, Object.assign({}, phone, { level: "sangha" }));
assert.ok(sanghaPhoneShelf.length > 0 && sanghaPhoneShelf.every((disc) => disc.circle === "vayu"));
assert.ok(!sanghaPhoneShelf.some((disc) => disc.id === "india-dream"));
assert.ok(!sanghaPhoneShelf.some((disc) => disc.circle === "zazen" || disc.circle === "lumikara" || disc.circle === "lineage"));
assert.ok(!sanghaPhoneShelf.some((disc) => disc.id === "samurai"), "a hidden Zazen album stays hidden");
assert.deepStrictEqual(P.visibleCircles(circles, sanghaPhoneShelf).map((circle) => circle.id), ["vayu"]);

const failedShelf = P.filterDiscs(catalog, failed).find((disc) => disc.id === "india-dream");
assert.ok(failedShelf, "the album stays while another song on it can play");
assert.ok(!failedShelf.tracks.some((track) => track.n === 3), "a song that failed this visit is left off the list");
assert.ok(failedShelf.tracks.length > 0);

const mixed = P.filterDiscs([{
  id: "mixed",
  circle: "vayu",
  title: "Mixed",
  tracks: [
    { n: 1, title: "Hosted", hosted: true, spotify: false, key: "mixed#1" },
    { n: 2, title: "Stream only", hosted: false, spotify: true, key: "mixed#2" },
  ],
}], phone);
assert.strictEqual(mixed.length, 1, "an album with one playable track stays");
assert.deepStrictEqual(mixed[0].tracks.map((track) => track.n), [1]);
assert.deepStrictEqual(P.filterTracks(mixed[0].tracks.map((track) => Object.assign({ circle: "vayu" }, track)), phone).map((track) => track.n), [1]);

const streamOnly = P.filterDiscs([{
  id: "stream",
  circle: "lineage",
  title: "Stream",
  tracks: [{ n: 1, title: "Only", hosted: false, spotify: true, key: "stream#1" }],
}], phone);
assert.deepStrictEqual(streamOnly, []);
assert.deepStrictEqual(P.visibleCircles([{ id: "lineage", name: "Lineage" }], streamOnly), []);

const quiet = Object.assign({}, desktop, { connected: false });
assert.strictEqual(P.trackOffered(samurai, quiet), true, "hosted audio stays when Spotify is not connected");
assert.strictEqual(P.trackOffered(maha, quiet), false);
assert.strictEqual(P.UNAVAILABLE, undefined);
assert.strictEqual(P.shelfDiscs, undefined);

assert.ok(!page.includes("Not available on this device yet"));
assert.ok(!page.includes("unavailable"));
assert.ok(!page.includes("disc.playable === false"));
assert.ok(page.includes("albums.some((item) => item.circle === circle.id)"));
assert.ok(!page.includes("pick-mix"), "there is no Mix It Up");
assert.ok(page.includes("if (track.playable === false) continue"));
const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const playback = fs.readFileSync(path.join(__dirname, "playback.js"), "utf8");
assert.ok(!web.includes('disc.circle === "lumikara"'), "web.js gates Lumikara through circleOpen");
assert.ok(web.includes("Playback.circleOpen(disc.circle, level)"));
assert.ok(web.includes("playable: true"));
assert.ok(web.includes("playable: itemPlayable"));
assert.ok(web.includes(".filter((disc) => disc.tracks.length > 0)"));
assert.ok(web.includes("Playback.visibleCircles"));
assert.ok(!web.includes("mixReady"));
assert.ok(!web.includes("Playback.UNAVAILABLE"));
assert.ok(!web.includes("Not available on this device yet"));
assert.ok(!playback.includes("Not available on this device yet"));
assert.ok(web.includes("markFailed(live.items[index], false)"));
assert.ok(!web.includes("markFailed(live.items[index], fromSpotify)"));
assert.ok(!web.includes("const fromSpotify"));
assert.ok(web.includes("spotify.play({ uris })"));
assert.ok(web.includes("spotify.sessionFailed || spotify.sdkFailed"));
assert.ok(web.includes("Playback.calmLine"));
assert.strictEqual(P.STALL_MS, 5000);

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

const quoteFile = JSON.parse(fs.readFileSync(path.join(__dirname, "quotes.json"), "utf8"));
const quotes = Array.isArray(quoteFile) ? quoteFile : quoteFile.quotes;
assert.ok(quotes.some((row) => row.text.includes("You decide to be happy") && row.href.includes("/balance/")));
assert.ok(quotes.every((row) => row.by === "Rama" && row.href && row.talk && row.text));

const plane = Object.assign({}, desktop, { offline: true, level: "zazen", cachedAlbums: { samurai: true } });
assert.strictEqual(P.trackOffered(samurai, plane), true, "a fully kept album still plays on a plane");
assert.strictEqual(P.trackOffered(maha, plane), false, "Spotify stays off the shelf offline");
assert.strictEqual(P.trackOffered(asTrack(discById("tantra"), 1), plane), false, "a hosted album that was not kept is left off");
assert.strictEqual(P.trackOffered(gems, Object.assign({}, plane, { level: "zazen" })), false, "Lumikara on Spotify is not offered offline");
const planeShelf = P.filterDiscs(catalog, plane);
assert.deepStrictEqual(planeShelf.map((disc) => disc.id), ["samurai"]);
assert.ok(!planeShelf.some((disc) => disc.id === "big-island"), "a partial download is not a shelf");
assert.ok(!planeShelf.some((disc) => disc.id === "india-dream"));
assert.deepStrictEqual(P.visibleCircles(circles, planeShelf).map((circle) => circle.id), ["zazen"]);

const sanghaPlane = Object.assign({}, phone, { offline: true, level: "sangha", cachedAlbums: new Set(["napa", "samurai"]) });
const sanghaPlaneShelf = P.filterDiscs(catalog, sanghaPlane);
assert.deepStrictEqual(sanghaPlaneShelf.map((disc) => disc.id), ["napa"]);
assert.ok(sanghaPlaneShelf.every((disc) => disc.circle === "vayu"));
assert.deepStrictEqual(P.visibleCircles(circles, sanghaPlaneShelf).map((circle) => circle.id), ["vayu"]);

const keptIsland = P.filterDiscs(catalog, Object.assign({}, phone, { offline: true, level: "sangha", cachedAlbums: { "big-island": true } }));
const kept = keptIsland.find((disc) => disc.id === "big-island");
assert.ok(kept, "a fully kept Vayu album stays for the sangha word");
assert.ok(kept.tracks.some((track) => track.n === 1));
assert.ok(!kept.tracks.some((track) => track.title === "Ocean Sunset"), "the song with no file is removed, not greyed");
assert.ok(!keptIsland.some((disc) => disc.circle !== "vayu"));

const failedPlane = P.filterDiscs(catalog, Object.assign({}, plane, { failedKeys: { "samurai#1": true } })).find((disc) => disc.id === "samurai");
assert.ok(failedPlane && failedPlane.tracks.length > 0);
assert.ok(!failedPlane.tracks.some((track) => track.n === 1));

const opening = P.sitFadePlan(240, { formal: true, first: true, last: true });
assert.strictEqual(opening.fadeIn, P.SIT_FADE_IN);
assert.strictEqual(opening.fadeOut, P.SIT_FADE_OUT);
assert.ok(P.sitGain(240, 0, opening) < 0.02, "a formal sit starts in silence");
assert.ok(P.sitGain(240, P.SIT_FADE_IN, opening) > 0.99, "the fade-in arrives at full level");
assert.ok(P.sitGain(240, 120, opening) > 0.99);
assert.ok(opening.releaseAt > 240 - 1);
assert.ok(P.sitGain(240, opening.releaseAt, opening) < 0.08, "the sit is quiet before it is released");
assert.ok(P.sitGain(240, 239.9, opening) < P.sitGain(240, 236, opening), "the ending keeps falling, it does not cut");

const middle = P.sitFadePlan(240, { formal: true, first: false, last: false });
assert.strictEqual(P.sitGain(240, 0, middle), 1);
assert.strictEqual(P.sitGain(240, 239, middle), 1);
const ending = P.sitFadePlan(240, { formal: true, first: false, last: true });
assert.ok(P.sitGain(240, 200, ending) > 0.99);
assert.ok(P.sitGain(240, ending.releaseAt, ending) < 0.08);
const casual = P.sitFadePlan(240, { formal: false, first: true, last: true });
assert.strictEqual(P.sitGain(240, 0, casual), 1, "album listening is left alone");

const short = P.sitFadePlan(10, { formal: true, first: true, last: true });
assert.ok(short.fadeIn + short.fadeOut < 10);
assert.ok(P.sitGain(10, short.fadeIn, short) > 0.95);

function hostedSession(level) {
  return { sdk: false, connected: true, blocked: false, failed: false, handset: false, failedKeys: {}, level: level };
}
function planSit(theme, count, albumId) {
  const phone = hostedSession("zazen");
  return Choose.planQuickSit({
    discs: discs.discs,
    level: "zazen",
    theme: theme,
    count: count,
    albumId: albumId,
    circleOpen: (circle, level) => circle !== "lumikara" || level === "zazen",
    canPlay(disc, track) {
      return !!(audio[disc.id] && audio[disc.id][String(track.n)]);
    },
    playable(item) {
      return !!(audio[discById(item.discId).id] && audio[item.discId][String(item.n)]);
    },
    keep() { return true; },
    rng: () => 0,
  });
}
for (const count of [1, 3, 6, 12]) {
  const result = planSit("morning", count, "enlightenment");
  assert.strictEqual(result.ok, true, "morning " + count);
  const disc = discById(result.albumId);
  const track = disc.tracks.find((row) => row.n === result.items[0].n);
  const first = P.sitLabel({
    sitting: true,
    album: disc.title,
    song: track.title,
    phase: "album",
    shown: "Samurai",
  });
  assert.strictEqual(first.text, disc.title, count + " songs first names the playing album");
  assert.strictEqual(first.dim, false, "a wrong shelf title is replaced, not faded from");
  assert.notStrictEqual(first.text, "Samurai");
  assert.notStrictEqual(disc.id, "samurai");
}
const evening = planSit("evening", 3, "canyons-of-light");
assert.strictEqual(discById(evening.albumId).title, "Canyons of Light");
const held = P.sitLabel({
  sitting: true,
  album: "Canyons of Light",
  song: "River",
  phase: "song",
  shown: "Canyons of Light",
});
assert.strictEqual(held.dim, true);
assert.strictEqual(held.text, "Canyons of Light");
const song = P.sitLabel({
  sitting: true,
  album: "Canyons of Light",
  song: "River",
  phase: "song",
  shown: "Canyons of Light",
  dim: true,
});
assert.strictEqual(song.text, "River");
assert.strictEqual(song.dim, false);
const reduced = P.sitLabel({
  sitting: true,
  album: "Canyons of Light",
  song: "River",
  phase: "song",
  shown: "Canyons of Light",
  reduce: true,
});
assert.strictEqual(reduced.text, "River");
assert.strictEqual(reduced.dim, false, "reduced motion swaps the title without a fade");
const chosen = P.sitLabel({ sitting: true, album: "Samurai", song: "First", phase: "album", shown: "Enlightenment" });
assert.strictEqual(chosen.text, "Samurai", "Samurai shows only when that album is the one playing");

assert.ok(page.includes("function armSitCaption"));
assert.ok(page.includes("paintSitCaption"));
assert.ok(page.includes("syncSitCaption"));
assert.ok(page.includes("if (data.albumTitle) armSitCaption"));
assert.ok(web.includes("function closeSit"));
assert.ok(web.includes("Playback.sitGain"));
assert.ok(web.includes("audio.volume = this.gainFor(index)"));
assert.ok(!web.includes("remaining < 3"), "the last song is no longer cut at full volume");
assert.strictEqual(P.SIT_FADE_IN, 4);
assert.strictEqual(P.SIT_FADE_OUT, 8);

console.log("playback.test.js ok");
