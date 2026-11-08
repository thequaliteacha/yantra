/* node web/choose.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Choose = require("./choose.js");
const Playback = require("./playback.js");

const audio = JSON.parse(fs.readFileSync(path.join(__dirname, "audio.json"), "utf8"));
const tracks = JSON.parse(fs.readFileSync(path.join(__dirname, "tracks.json"), "utf8"));
const discs = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "discs.json"), "utf8"));
const sets = JSON.parse(fs.readFileSync(path.join(__dirname, "sets.json"), "utf8"));
const page = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function discById(id) {
  return discs.discs.find((disc) => disc.id === id);
}

function asTrack(disc, n) {
  const row = (tracks[disc.id] || {})[String(n)] || {};
  return {
    discId: disc.id,
    n: n,
    circle: disc.circle,
    hosted: !!(audio[disc.id] && audio[disc.id][String(n)]),
    spotify: !!row.spotify,
    key: disc.id + "#" + n,
  };
}

function session(level, sdk) {
  return {
    sdk: !!sdk,
    connected: true,
    blocked: false,
    failed: false,
    handset: false,
    failedKeys: {},
    level: level || "",
  };
}

function themeIds(theme) {
  const ids = [];
  const set = sets[theme] || {};
  for (const chakra of ["naval", "heart", "eye"]) {
    for (const song of set[chakra] || []) {
      if (ids.indexOf(song.discId) < 0) ids.push(song.discId);
    }
  }
  const one = sets.oneSong && sets.oneSong[theme];
  if (one && ids.indexOf(one.discId) < 0) ids.push(one.discId);
  return ids;
}

function blueprint(theme, count) {
  if (count === 1) {
    const one = sets.oneSong[theme];
    return [{ discId: one.discId, n: one.n, chakra: "heart" }];
  }
  const per = { 3: 1, 6: 2, 12: 4 }[count];
  const items = [];
  for (const chakra of ["naval", "heart", "eye"]) {
    for (const song of sets[theme][chakra].slice(0, per)) items.push({ discId: song.discId, n: song.n, chakra });
  }
  return items;
}

function plan(extra) {
  const level = extra.level || "zazen";
  const phone = extra.session || session(level, false);
  return Choose.planQuickSit(Object.assign({
    discs: discs.discs,
    level: level,
    circleOpen: Playback.circleOpen,
    themeIds: themeIds(extra.theme || "evening"),
    canPlay(disc, track) {
      return Playback.trackOffered(asTrack(disc, track.n), phone);
    },
    playable(item) {
      const disc = discById(item.discId);
      return !!disc && Playback.trackOffered(asTrack(disc, item.n), phone);
    },
    keep(item) {
      const disc = discById(item.discId);
      return !!disc && asTrack(disc, item.n).hosted;
    },
    substitute(chakra, used) {
      for (const disc of discs.discs) {
        if (!Playback.circleOpen(disc.circle, level)) continue;
        for (const track of disc.tracks) {
          const key = disc.id + "#" + track.n;
          if (used.has(key)) continue;
          const row = asTrack(disc, track.n);
          if (!row.hosted || !Playback.trackOffered(row, phone)) continue;
          if (Choose.trackChakra(disc, track.n) !== chakra) continue;
          return { discId: disc.id, n: track.n };
        }
      }
      return null;
    },
    rng: () => 0,
  }, extra));
}

function assertPlayable(result, phone) {
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.announce, false);
  assert.ok(result.items && result.items.length);
  for (const item of result.items) {
    const disc = discById(item.discId);
    assert.ok(disc, item.discId);
    assert.ok(Playback.circleOpen(disc.circle, phone.level), disc.id + " is closed for " + phone.level);
    assert.strictEqual(Playback.trackOffered(asTrack(disc, item.n), phone), true, disc.id + " #" + item.n);
  }
}

const sits = [
  ["morning", 1, 4],
  ["morning", 3, 12],
  ["morning", 6, 24],
  ["morning", 12, 48],
  ["evening", 1, 4],
  ["evening", 3, 12],
  ["evening", 6, 24],
  ["evening", 12, 48],
];

for (const [theme, count, minutes] of sits) {
  for (const level of ["zazen", "sangha"]) {
    const phone = session(level, false);
    const result = plan({ theme, count, level, session: phone, albumId: "", mix: false });
    assertPlayable(result, phone);
    assert.strictEqual(result.items.length, count, theme + " " + count + " (" + minutes + " min)");
    assert.strictEqual(result.via, "default");
    const circles = new Set(result.items.map((item) => discById(item.discId).circle));
    if (level === "zazen") {
      assert.ok(Choose.sitAlbumIds("zazen").indexOf(result.albumId) >= 0, theme + " " + count + " stays on a Zazen sit album");
      assert.deepStrictEqual([...circles], ["zazen"], theme + " " + count);
      assert.notStrictEqual(result.albumId, "mystery-school");
      assert.notStrictEqual(result.albumId, "india-dream");
    } else {
      assert.deepStrictEqual([...circles], ["vayu"], theme + " " + count + " stays with the sit's theme");
      assert.ok(result.items.every((item) => discById(item.discId).circle === "vayu"));
      assert.notStrictEqual(result.albumId, "samurai");
      assert.notStrictEqual(result.albumId, "india-dream");
    }
    assert.notStrictEqual(discById(result.albumId).circle, "lumikara");
    if (count === 1) assert.deepStrictEqual(result.items.map((item) => item.chakra), ["heart"]);
    else {
      const per = count / 3;
      assert.deepStrictEqual(result.items.map((item) => item.chakra), (
        ["naval", "heart", "eye"].flatMap((chakra) => Array(per).fill(chakra))
      ));
    }
  }
}

const eveningPhone = session("zazen", false);
const evening = plan({ theme: "evening", count: 3, session: eveningPhone, albumId: "" });
assert.ok(Choose.sitAlbumIds("zazen").indexOf(evening.albumId) >= 0, "a free evening sit stays on a Zazen sit album");
assert.notStrictEqual(evening.albumId, "big-island");
assert.ok(evening.items.every((item) => asTrack(discById(item.discId), item.n).hosted));

const remembered = plan({ theme: "evening", count: 3, albumId: "india-dream" });
assert.notStrictEqual(remembered.albumId, "india-dream");
assert.strictEqual(remembered.via, "default", "an album outside the sit list is not a remembered fallback");
assert.ok(Choose.sitAlbumIds("zazen").indexOf(remembered.albumId) >= 0);
assert.strictEqual(remembered.announce, false);
assertPlayable(remembered, eveningPhone);

const golden = plan({ theme: "evening", count: 12, albumId: "golden" });
assert.notStrictEqual(golden.albumId, "golden");
assert.ok(Choose.sitAlbumIds("zazen").indexOf(golden.albumId) >= 0);
assert.strictEqual(golden.announce, false);

const kept = plan({ theme: "evening", count: 3, albumId: "samurai" });
assert.strictEqual(kept.via, "album");
assert.strictEqual(kept.albumId, "samurai", "a hosted album the listener chose still plays");
assert.ok(kept.items.every((item) => asTrack(discById(item.discId), item.n).hosted));
assert.strictEqual(kept.announce, false);

const rotated = plan({ theme: "evening", count: 3, albumId: "", lastId: "big-island" });
assert.notStrictEqual(rotated.albumId, "big-island");
assert.ok(Choose.sitAlbumIds("zazen").indexOf(rotated.albumId) >= 0);

const crossAsk = plan({ theme: "evening", count: 3, mix: true, albumId: "samurai" });
assert.strictEqual(crossAsk.albumId, "samurai", "a sit never crosses albums, even if asked to mix");
assert.strictEqual(new Set(crossAsk.items.map((item) => item.discId)).size, 1);

const lumikara = plan({ theme: "evening", count: 3, level: "zazen", albumId: "awake-in-anza-borrego" });
assert.notStrictEqual(lumikara.albumId, "awake-in-anza-borrego");
assert.notStrictEqual(discById(lumikara.albumId).circle, "lumikara");
assert.ok(Choose.sitAlbumIds("zazen").indexOf(lumikara.albumId) >= 0);
assert.strictEqual(lumikara.announce, false);

const excluded = plan({ theme: "morning", count: 3, level: "zazen", albumId: "mystery-school" });
assert.notStrictEqual(excluded.albumId, "mystery-school");
assert.ok(Choose.sitAlbumIds("zazen").indexOf(excluded.albumId) >= 0);
assert.strictEqual(excluded.via, "default");

const hidden = plan({ theme: "morning", count: 3, level: "sangha", albumId: "samurai", session: session("sangha", false) });
assert.ok(hidden.items.every((item) => discById(item.discId).circle === "vayu"));
assert.notStrictEqual(hidden.albumId, "samurai");
assert.notStrictEqual(hidden.albumId, "awake-in-anza-borrego");

const desktop = session("zazen", true);
const asked = plan({ theme: "evening", count: 3, albumId: "india-dream", session: desktop });
assert.notStrictEqual(asked.albumId, "india-dream", "a Zazen sit does not take a Vayu album from Spotify");
assert.ok(Choose.sitAlbumIds("zazen").indexOf(asked.albumId) >= 0);
assert.strictEqual(asked.announce, false, "the plan itself never raises the Spotify panel");

const sanghaDesktop = plan({
  theme: "evening",
  count: 3,
  albumId: "india-dream",
  level: "sangha",
  session: session("sangha", true),
});
assert.strictEqual(sanghaDesktop.via, "album");
assert.strictEqual(sanghaDesktop.albumId, "india-dream", "Sangha still plays the asked Vayu album where Spotify runs");

const playlistPhone = session("zazen", true);
const playlist = Choose.planQuickSit({
  discs: discs.discs,
  level: "zazen",
  formal: false,
  circleOpen: Playback.circleOpen,
  themeIds: themeIds("evening"),
  albumId: "india-dream",
  count: 3,
  theme: "evening",
  canPlay(disc, track) { return Playback.trackOffered(asTrack(disc, track.n), playlistPhone); },
  playable(item) { return Playback.trackOffered(asTrack(discById(item.discId), item.n), playlistPhone); },
  keep() { return true; },
  rng: () => 0,
});
assert.strictEqual(playlist.albumId, "india-dream", "playlist recovery is not limited to the sit albums");

const none = plan({
  theme: "evening",
  count: 3,
  canPlay: () => false,
  playable: () => false,
  keep: () => false,
  substitute: () => null,
});
assert.strictEqual(none.ok, false);
assert.strictEqual(none.line, Choose.emptyLine());
assert.ok(!/spotify/i.test(none.line));
assert.strictEqual(none.items, undefined);

assert.strictEqual(Choose.announceSwap({ explicit: true, swapped: true, spotifyExpected: true }), true);
assert.strictEqual(Choose.announceSwap({ explicit: true, swapped: true, spotifyExpected: false }), false, "a phone does not announce");
assert.strictEqual(Choose.announceSwap({ explicit: false, swapped: true, spotifyExpected: true }), false, "an album the app chose does not announce");
assert.strictEqual(Choose.announceSwap({ explicit: true, swapped: false, spotifyExpected: true }), false);

assert.strictEqual(Choose.planQuickSit({ count: 9, discs: discs.discs, canPlay: () => true }).ok, false);

const planned = web.slice(web.indexOf("async function startPlanned"), web.indexOf("async function startSession"));
const hostedAt = planned.indexOf("if (recordedAll(items))");
const announceAt = planned.indexOf("announceSwap");
assert.ok(hostedAt > 0 && announceAt > hostedAt, "hosted audio starts without the Spotify panel");
assert.ok(planned.includes("hostedPlan"));
assert.ok(web.includes("function sitPlan"));
assert.ok(web.includes("Choose.planQuickSit"));
assert.ok(web.includes("Choose.emptyLine"));
assert.ok(!web.includes("if (!unavailable && recordedAll"));
assert.ok(web.includes("window.playSession(pending.theme, pending.count"), "resume replays through the same sit");
assert.ok(web.includes("hostedPlan"));

const readyAt = page.indexOf("function openReadySit");
const readyFn = page.slice(readyAt, page.indexOf("window.openReadySit"));
assert.ok(readyAt > 0);
assert.ok(!readyFn.includes("playSession"), "a reminder deep link opens the sit, it does not start an album");
assert.ok(page.includes('params.get("ready")'));
assert.ok(fs.readFileSync(path.join(__dirname, "schedule.js"), "utf8").includes('"/web/?ready="'));
assert.ok(page.includes("playSession(sessionTheme, Number(button.dataset.count))"));

const spinAt = page.indexOf("window.wheelSpin");
const spin = page.slice(spinAt, spinAt + 180);
assert.ok(spin.startsWith("window.wheelSpin"));
assert.ok(!spin.includes("playSession"));
assert.ok(!spin.includes("album"));
assert.ok(!spin.includes("spotify"), "the wheel spin draws the figure; it does not choose music");

assert.ok(shell.indexOf('src="choose.js"') > 0);
assert.ok(shell.indexOf('src="choose.js"') < shell.indexOf('src="web.js"'));

const mystery = discById("mystery-school");
assert.strictEqual(Choose.sitMinutes(mystery, 1), 7, "one song is a heart song, not the first track");
assert.strictEqual(Choose.sitMinutes(mystery, 3), 27);
assert.strictEqual(Choose.sitMinutes(mystery, 6), 54);
assert.strictEqual(Choose.sitMinutes(mystery, 12), null, "twelve needs four songs in each third");
const firstThree = mystery.tracks.slice(0, 3).reduce((sum, track) => sum + track.length, 0);
assert.notStrictEqual(Choose.sitMinutes(mystery, 3), Math.round(firstThree / 60), "not the first three tracks");
assert.strictEqual(Choose.sitMinutes({ tracks: [
  { n: 1, length: 600, chakra: "heart" },
  { n: 2, length: 60, chakra: "naval" },
  { n: 3, length: 60, chakra: "eye" },
] }, 1), 10, "a stored chakra band wins over track order");
assert.strictEqual(Choose.sitMinutes({ tracks: [
  { n: 1, length: 0, chakra: "naval" },
  { n: 2, length: 0, chakra: "heart" },
  { n: 3, length: 0, chakra: "eye" },
] }, 3), null);
assert.strictEqual(Choose.catalogMinutes([], 3), 12, "an empty catalog keeps the old four minutes a song");
const measurable = discs.discs.map((disc) => Choose.sitSeconds(disc, 3)).filter((seconds) => seconds);
const expectedAverage = Math.max(1, Math.round(measurable.reduce((sum, seconds) => sum + seconds, 0) / measurable.length / 60));
assert.strictEqual(Choose.catalogMinutes(discs.discs, 3), expectedAverage);
assert.ok(measurable.length > 1);
assert.ok(page.includes("window.YantraChoose"));
assert.ok(page.includes("choose.sitMinutes(chosen, count)"));
assert.ok(page.includes("choose.catalogMinutes(discs, count)"));
assert.ok(page.includes("· about "), "a new album each sit is marked as an average");

assert.deepStrictEqual(Choose.sitAlbumIds("zazen"), [
  "enlightenment",
  "canyons-of-light",
  "samurai",
  "samadhi",
  "ecstasy",
  "cayman-blue",
]);
assert.strictEqual(Choose.sitAlbumIds("sangha"), null);
assert.strictEqual(Choose.sitAlbumIds(""), null);
assert.strictEqual(Choose.sitDefault("zazen", "morning"), "enlightenment");
assert.strictEqual(Choose.sitDefault("zazen", "evening"), "canyons-of-light");
assert.strictEqual(discById("cayman-blue").title, "Cayman Blue");
assert.strictEqual(audio["cayman-blue"], undefined, "Cayman Blue has no hosted recordings to invent");
assert.strictEqual(tracks["cayman-blue"], undefined, "Cayman Blue has no Spotify links to invent");
const playableSix = ["enlightenment", "canyons-of-light", "samurai", "samadhi", "ecstasy"];
assert.strictEqual(Choose.sitChoice("zazen", "morning", "", playableSix, false), "enlightenment");
assert.strictEqual(Choose.sitChoice("zazen", "evening", "", playableSix, false), "canyons-of-light");
assert.strictEqual(Choose.sitChoice("zazen", "morning", "samurai", playableSix, true), "samurai");
assert.strictEqual(Choose.sitChoice("zazen", "evening", "samurai", playableSix, true), "samurai");
assert.strictEqual(Choose.sitChoice("zazen", "evening", "", playableSix, true), "", "an explicit new album stays empty");
assert.strictEqual(Choose.sitChoice("zazen", "morning", "mystery-school", playableSix, true), "enlightenment");
assert.strictEqual(Choose.sitChoice("zazen", "evening", "mystery-school", playableSix, true), "canyons-of-light");
assert.strictEqual(Choose.sitChoice("zazen", "morning", "enlightenment", ["samurai"], true), "samurai", "offline uses a sit album that can play");
assert.strictEqual(Choose.sitChoice("zazen", "evening", "canyons-of-light", ["samurai"], true), "samurai");
assert.strictEqual(Choose.sitChoice("sangha", "morning", "big-island", ["big-island", "samurai"], true), "big-island");
const ordered = Choose.sitDiscs(discs.discs, "zazen").map((disc) => disc.id);
assert.deepStrictEqual(ordered, Choose.sitAlbumIds("zazen"));
assert.ok(Choose.sitDiscs(discs.discs, "sangha").some((disc) => disc.id === "india-dream"));
assert.ok(Choose.sitDiscs(discs.discs, "sangha").some((disc) => disc.id === "mystery-school"));
assert.ok(discs.discs.some((disc) => disc.id === "mystery-school"), "excluded albums stay in the catalog");

const offlineSit = plan({
  theme: "morning",
  count: 3,
  albumId: "enlightenment",
  session: Object.assign(session("zazen", false), { offline: true, cachedAlbums: { samurai: true, "mystery-school": true } }),
});
assert.strictEqual(offlineSit.ok, true);
assert.strictEqual(offlineSit.albumId, "samurai", "a cached sit album is used when the default is not kept");
assert.notStrictEqual(offlineSit.albumId, "mystery-school");

const offlineExcluded = plan({
  theme: "evening",
  count: 3,
  albumId: "mystery-school",
  session: Object.assign(session("zazen", false), { offline: true, cachedAlbums: { "mystery-school": true } }),
});
assert.strictEqual(offlineExcluded.ok, false, "a cached album outside the sit list does not start a formal sit");

const askedEnlightenment = plan({ theme: "morning", count: 3, albumId: "enlightenment" });
assert.strictEqual(askedEnlightenment.albumId, "enlightenment");
assert.strictEqual(askedEnlightenment.via, "album");
const askedCanyons = plan({ theme: "evening", count: 3, albumId: "canyons-of-light" });
assert.strictEqual(askedCanyons.albumId, "canyons-of-light");
assert.strictEqual(askedCanyons.via, "album");

const shelf = page.slice(page.indexOf("function renderShelf"), page.indexOf("function chakraLabel"));
assert.ok(shelf.includes("collection.discs"), "the album shelf is the full playable catalog");
assert.ok(!shelf.includes("sitDiscs"), "resources are not filtered to the sit list");
assert.ok(page.includes("choose.sitDiscs"));
assert.ok(page.includes("choose.sitChoice"));
assert.ok(page.includes('localStorage.removeItem("yantra.sitAlbum")'));
assert.ok(web.includes("Choose.sitDiscs"));
assert.ok(web.includes('hostedPlan("morning", 3, false)'), "playlist recovery is not a formal sit list");
assert.ok(web.includes('fields.mode === "session"'));

console.log("choose.test.js ok");
