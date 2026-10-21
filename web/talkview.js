/* Watching a Dharma talk: the yantra draws itself across the talk, and the words
 * being spoken embellish it. The timed words come from /talks/<key>.json, made on
 * the builder's computer (tools/transcribe_talks.py) and gated like the audio.
 *
 * Words of light send soft rays out; words of the heart, of power, and of awareness
 * lean the colour toward that chakra; words of stillness hush the figure; words of
 * enlightenment let it bloom. The phrase being spoken can show below, each word
 * brightening as it is said.
 */
(function (root) {
  const LEXICON = {
    naval: ["power", "powerful", "energy", "strength", "strong", "tough", "body", "discipline", "career", "success", "fire", "force", "courage"],
    heart: ["heart", "love", "loving", "kind", "kindness", "compassion", "happiness", "happy", "joy", "joyful", "beauty", "beautiful", "balance", "gentle", "devotion", "gratitude", "grateful", "sweet", "sweetness"],
    eye: ["awareness", "aware", "consciousness", "conscious", "mind", "minds", "thought", "thoughts", "perception", "perceive", "seeing", "vision", "wisdom", "wise", "knowledge", "intuition", "dimension", "dimensions", "planes", "attention", "focus"],
    light: ["light", "lights", "radiant", "radiance", "luminous", "luminosity", "sun", "bright", "brightness", "shine", "shining", "glow", "golden"],
    still: ["silence", "silent", "stillness", "quiet", "calm", "peace", "peaceful", "emptiness", "void", "nothingness", "rest"],
    awake: ["enlightenment", "enlightened", "nirvana", "liberation", "liberated", "samadhi", "god", "eternity", "eternal", "infinite", "infinity", "timeless", "ecstasy"],
  };
  const KIND = {};
  Object.keys(LEXICON).forEach((kind) => LEXICON[kind].forEach((word) => { KIND[word] = kind; }));
  const MOODS = ["naval", "heart", "eye"];

  function clean(word) {
    return String(word || "").toLowerCase().replace(/[^a-z']/g, "").replace(/'s$/, "");
  }

  /* What a spoken word does to the figure: a chakra mood, a motif, or nothing. */
  function kindOf(word) {
    return KIND[clean(word)] || "";
  }

  function sketches() {
    if (root && root.YantraSketches) return root.YantraSketches;
    if (typeof require === "function") return require("./sketches.js");
    return null;
  }
  function sketchOf(word) {
    const S = sketches();
    return S ? S.sketchOf(word) : "";
  }

  /* The segment playing at time t, or -1. Segments are [start, end, text, words]. */
  function segmentAt(segments, t) {
    if (!Array.isArray(segments) || !segments.length) return -1;
    let lo = 0;
    let hi = segments.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid][0] <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    // A pause between phrases keeps the last phrase up for a breath, then clears.
    if (found >= 0 && t > segments[found][1] + 2.5) return -1;
    return found;
  }

  /* Words whose start falls in (from, to], with their kinds. */
  function crossed(segments, from, to) {
    const out = [];
    if (!Array.isArray(segments) || !(to > from) || to - from > 3) return out;
    let i = Math.max(0, segmentAt(segments, from));
    for (; i < segments.length && segments[i][0] <= to; i++) {
      for (const pair of segments[i][3] || []) {
        if (pair[0] > from && pair[0] <= to) {
          const kind = kindOf(pair[1]);
          const sketch = sketchOf(pair[1]);
          if (kind || sketch) out.push({ at: pair[0], word: pair[1], kind, sketch });
        }
      }
    }
    return out;
  }

  /* The figure's state as the talk plays. Strengths decay so each word is a gentle wave. */
  function createState() {
    return { mood: "", light: 0, awake: 0, still: 0, ripples: [], sketches: [], drawnAt: {}, lastSketch: -99, lastT: -1 };
  }

  const DECAY = { light: 6, awake: 9, still: 14 };
  // A sketch draws itself, rests, then fades; the same one waits before it returns.
  const SKETCH = { draw: 1.8, hold: 5, fade: 2.2, again: 45, gap: 5, most: 2 };
  const SLOTS = 4;

  function addSketch(s, name, t) {
    if (t - s.lastSketch < SKETCH.gap) return;
    if (s.drawnAt[name] != null && t - s.drawnAt[name] < SKETCH.again) return;
    if (s.sketches.length >= SKETCH.most) return;
    const used = s.sketches.map((sk) => sk.slot);
    let slot = (s.nextSlot || 0) % SLOTS;
    for (let i = 0; i < SLOTS && used.indexOf(slot) >= 0; i++) slot = (slot + 1) % SLOTS;
    s.nextSlot = slot + 1;
    s.sketches.push({ name: name, age: 0, slot: slot });
    s.drawnAt[name] = t;
    s.lastSketch = t;
  }

  /* How far a sketch is drawn (0..1) and how visible it is (0..1) at its age. */
  function sketchPhase(age) {
    const drawn = Math.min(1, age / SKETCH.draw);
    const end = SKETCH.draw + SKETCH.hold;
    const alpha = age < end ? 1 : Math.max(0, 1 - (age - end) / SKETCH.fade);
    return { drawn: drawn, alpha: alpha };
  }

  function step(state, segments, t, dt) {
    const s = state;
    for (const key of Object.keys(DECAY)) s[key] = Math.max(0, s[key] - dt / DECAY[key]);
    if (s.lastT >= 0 && t > s.lastT) {
      for (const hit of crossed(segments, s.lastT, t)) {
        if (hit.sketch) addSketch(s, hit.sketch, hit.at);
        if (!hit.kind) continue;
        if (MOODS.indexOf(hit.kind) >= 0) s.mood = hit.kind;
        else s[hit.kind] = Math.min(1, s[hit.kind] + (hit.kind === "still" ? 0.6 : 0.8));
        if (hit.kind !== "still") s.ripples.push({ age: 0, kind: hit.kind });
      }
    }
    s.lastT = t;
    s.ripples.forEach((ripple) => { ripple.age += dt; });
    s.ripples = s.ripples.filter((ripple) => ripple.age < 5).slice(-6);
    s.sketches.forEach((sk) => { sk.age += dt; });
    s.sketches = s.sketches.filter((sk) => sk.age < SKETCH.draw + SKETCH.hold + SKETCH.fade);
    return s;
  }

  /* ---- the words on screen ---- */

  function paintWords(node, segments, index, t, doc) {
    if (!node) return;
    const d = doc || node.ownerDocument;
    if (node.dataset.index !== String(index)) {
      node.dataset.index = String(index);
      node.replaceChildren();
      node.classList.toggle("on", index >= 0);
      if (index < 0) return;
      const words = segments[index][3] || [];
      if (!words.length) {
        node.textContent = segments[index][2] || "";
        return;
      }
      words.forEach((pair, i) => {
        const span = d.createElement("span");
        span.textContent = (i ? " " : "") + pair[1];
        span.dataset.at = String(pair[0]);
        const kind = kindOf(pair[1]) || (sketchOf(pair[1]) ? "sketch" : "");
        if (kind) span.className = "k-" + kind;
        node.append(span);
      });
    }
    if (index < 0) return;
    node.querySelectorAll("span").forEach((span) => {
      span.classList.toggle("said", Number(span.dataset.at) <= t + 0.05);
    });
  }

  /* Loads the timed words for a talk's audio path. Null when there are none yet. */
  async function loadWords(src, fetcher) {
    const path = String(src || "");
    if (!/^\/talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/.test(path) || path.includes("..")) return null;
    try {
      const response = await (fetcher || fetch)(path.replace(/\.mp3$/, ".json"), { cache: "default" });
      if (!response.ok) return null;
      const data = await response.json();
      return data && Array.isArray(data.segments) ? data.segments : null;
    } catch (e) {
      return null;
    }
  }

  const api = { LEXICON, SKETCH, kindOf, sketchOf, segmentAt, crossed, createState, step, sketchPhase, paintWords, loadWords };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraTalkView = api;
})(typeof window !== "undefined" ? window : null);
