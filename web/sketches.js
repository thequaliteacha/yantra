/* Line sketches that draw themselves beside the yantra while a talk speaks of them,
 * in the spirit of a hand drawing ideas as they are said. Each is a few strokes in a
 * 100 x 100 box; every stroke starts with an absolute M so it can be drawn in turn.
 */
(function (root) {
  const SKETCHES = {
    sun: "M64 50a14 14 0 1 1-28 0a14 14 0 1 1 28 0 M50 30V18 M50 70v12 M30 50H18 M70 50h12 M36 36l-8-8 M64 64l8 8 M64 36l8-8 M36 64l-8 8",
    moon: "M60 18a32 32 0 1 0 22 52a26 26 0 1 1-22-52z M78 26l2 5l5 1l-5 2l-2 5l-2-5l-5-2l5-1z",
    mountain: "M6 82l28-42l12 16l16-30l32 56z M54 38l8 12l6-6",
    wave: "M6 50q11-14 22 0t22 0t22 0t22 0 M6 66q11-14 22 0t22 0t22 0t22 0 M6 82q11-14 22 0t22 0t22 0t22 0",
    tree: "M50 92V58 M50 74l-10-8 M50 68l10-8 M28 40a22 20 0 1 0 44 0a22 20 0 1 0-44 0 M30 92h40",
    lotus: "M50 70c-10-12-10-30 0-44c10 14 10 32 0 44z M50 70c-18-2-28-16-30-30c14 2 26 12 30 30z M50 70c18-2 28-16 30-30c-14 2-26 12-30 30z M22 76q28 12 56 0",
    eye: "M8 50q42-38 84 0q-42 38-84 0z M61 50a11 11 0 1 1-22 0a11 11 0 1 1 22 0 M53 50a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
    heart: "M50 84c-30-20-40-36-34-50c6-14 26-14 34 2c8-16 28-16 34-2c6 14-4 30-34 50z",
    flame: "M50 90c-16 0-24-12-20-26c4-12 14-16 12-34c12 8 20 20 18 30c4-4 6-10 4-16c8 8 10 22 4 32c-4 8-10 14-18 14z M50 90c-6 0-10-6-8-12c2-6 8-8 8-14c6 6 8 12 6 18c-1 5-3 8-6 8z",
    path: "M8 34h84 M22 92l22-58 M78 92l-22-58 M50 86v-8 M50 70v-7 M50 56v-5 M50 45v-4",
    door: "M30 90V30a20 20 0 0 1 40 0v60 M8 90h84 M62 60a2 2 0 1 1-4 0a2 2 0 1 1 4 0",
    bird: "M10 54q18-16 36 4q18-22 40-8 M56 26q6-6 12 1q6-7 14-2 M30 30q4-4 8 1q4-5 9-1",
    sprout: "M50 90V58 M50 66c-4-14-18-18-28-14c4 12 16 18 28 14z M50 60c4-16 18-22 30-18c-4 14-18 20-30 18z M28 90h44",
    star: "M50 12l10 26h28l-22 17l8 27l-24-16l-24 16l8-27l-22-17h28z M86 76l1 3l3 1l-3 1l-1 3l-1-3l-3-1l3-1z",
    cloud: "M30 60h40a12 12 0 0 0 0-24a16 16 0 0 0-30-6a13 13 0 0 0-10 30z M30 74a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M20 86a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0",
    sitter: "M57 20a7 7 0 1 1-14 0a7 7 0 1 1 14 0 M50 28c-8 0-12 7-12 17v9 M50 28c8 0 12 7 12 17v9 M38 46l12 10l12-10 M38 54c-6 3-20 7-24 14c12 7 60 7 72 0c-4-7-18-11-24-14",
    infinity: "M50 50c-10-14-32-14-32 0s22 14 32 0s32-14 32 0s-22 14-32 0z",
    earth: "M84 50a34 34 0 1 1-68 0a34 34 0 1 1 68 0 M16 50h68 M50 16c-14 10-14 58 0 68 M50 16c14 10 14 58 0 68 M22 32h56 M22 68h56",
    river: "M28 8c22 20-22 32 0 52s-12 30 10 32 M52 8c22 20-22 32 0 52s-12 30 10 32",
    wheel: "M80 50a30 30 0 1 1-60 0a30 30 0 1 1 60 0 M56 50a6 6 0 1 1-12 0a6 6 0 1 1 12 0 M50 20v24 M50 56v24 M20 50h24 M56 50h24 M29 29l17 17 M54 54l17 17 M71 29l-17 17 M46 54l-17 17",
    book: "M50 30c-12-8-28-8-38-4v52c10-4 26-4 38 4c12-8 28-8 38-4V26c-10-4-26-4-38 4z M50 30v52",
  };

  const WORDS = {
    sun: ["sun", "sunlight", "sunrise", "sunset", "dawn"],
    moon: ["moon", "night", "dream", "dreams", "dreaming"],
    mountain: ["mountain", "mountains", "climb", "climbing", "summit", "peak"],
    wave: ["ocean", "oceans", "sea", "wave", "waves", "water"],
    tree: ["tree", "trees", "forest", "nature", "roots"],
    lotus: ["lotus", "flower", "flowers", "blossom", "bloom"],
    eye: ["eye", "eyes", "perception", "vision", "seeing"],
    heart: ["heart", "hearts", "love"],
    flame: ["fire", "flame", "candle", "burning"],
    path: ["path", "paths", "road", "journey"],
    door: ["door", "doors", "doorway", "gateway", "threshold"],
    bird: ["bird", "birds", "freedom", "flying", "wings"],
    sprout: ["seed", "seeds", "grow", "growth", "growing"],
    star: ["star", "stars", "universe", "cosmos", "cosmic", "galaxy"],
    cloud: ["thought", "thoughts", "thinking", "cloud", "clouds"],
    sitter: ["meditate", "meditating", "meditation", "meditator"],
    infinity: ["infinite", "infinity", "eternity", "eternal", "forever", "endless"],
    earth: ["earth", "world", "planet"],
    river: ["river", "rivers", "flow", "flowing", "stream"],
    wheel: ["karma", "reincarnation", "rebirth", "cycle", "cycles", "lifetimes"],
    book: ["book", "books", "study", "studying", "knowledge", "learn", "learning"],
  };
  const BY_WORD = {};
  Object.keys(WORDS).forEach((name) => WORDS[name].forEach((word) => { BY_WORD[word] = name; }));

  function sketchOf(word) {
    const clean = String(word || "").toLowerCase().replace(/[^a-z']/g, "").replace(/'s$/, "");
    return BY_WORD[clean] || "";
  }

  /* The strokes of a sketch, each starting with its own M. */
  function strokes(name) {
    const d = SKETCHES[name];
    return d ? d.split(/\s(?=M)/) : [];
  }

  const api = { SKETCHES, WORDS, sketchOf, strokes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraSketches = api;
})(typeof window !== "undefined" ? window : null);
