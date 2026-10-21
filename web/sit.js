/* Timed-sit choices. No audio here: just the minutes, the bell times, and the tone at each one. */
(function (root) {
  const PRESETS = [5, 10, 15, 20, 30, 45, 60];
  const DEFAULT_MINUTES = 15;
  const MAX_MINUTES = 240;
  const TONES = ["small", "medium", "deep"];
  const MIDWAY = ["none", "half", "two"];
  const BEDS = ["silent", "white", "pink", "brown", "rain-light", "rain-steady", "rain-roof", "rain-thunder", "drone", "bowl", "pad"];

  function minutes(value) {
    if (typeof value === "string" && value.trim() === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(number) || number < 1 || number > MAX_MINUTES) return null;
    return number;
  }

  function tone(value, fallback) {
    return TONES.indexOf(value) >= 0 ? value : (TONES.indexOf(fallback) >= 0 ? fallback : "medium");
  }

  function choice(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  /* 0 silent, 1 single, 2 double, 3 triple, 4 quadruple. Anything else uses the fallback. */
  function strikes(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = typeof value === "number" ? value : Number(value);
    if (n === 0 || n === 1 || n === 2 || n === 3 || n === 4) return n;
    return fallback;
  }

  /* Start, halfway or the two quarter bells, and the end. Times are seconds from the start. */
  function bellTimes(minutesValue, midway) {
    const length = minutes(minutesValue);
    const sitMinutes = length == null ? DEFAULT_MINUTES : length;
    const duration = sitMinutes * 60;
    const mode = choice(midway, MIDWAY, "none");
    const marks = [{ position: "start", at: 0 }];
    if (mode === "half") marks.push({ position: "half", at: duration * 0.5 });
    if (mode === "two") {
      marks.push({ position: "quarter", at: duration * 0.25 });
      marks.push({ position: "threeQuarter", at: duration * 0.75 });
    }
    marks.push({ position: "end", at: duration });
    return { minutes: sitMinutes, duration: duration, midway: mode, marks: marks };
  }

  /* What a sit will ring. An unset pattern keeps a single start, one softer midway strike, and three at the end. */
  function plan(options) {
    const source = options || {};
    const clock = bellTimes(source.minutes, source.midway);
    const same = source.sameTone !== false;
    const startTone = tone(source.startTone, "medium");
    const at = {
      start: source.startTone,
      half: source.halfTone,
      quarter: source.quarterTone,
      threeQuarter: source.threeQuarterTone,
      end: source.endTone,
    };
    const toneAt = (position) => (same ? startTone : tone(at[position], startTone));
    const startStrikes = strikes(source.startStrikes, source.start === false ? 0 : 1);
    const midStrikes = strikes(source.midStrikes, 1);
    const endStrikes = strikes(source.endStrikes, source.ending === false ? 0 : 3);
    const events = [];
    clock.marks.forEach((mark) => {
      if (mark.position === "start" && startStrikes > 0) {
        events.push({ at: mark.at, position: "start", tone: toneAt("start"), strikes: startStrikes, gain: 1 });
      }
      if (mark.position === "half" && midStrikes > 0) {
        events.push({ at: mark.at, position: "half", tone: toneAt("half"), strikes: midStrikes, gain: 0.55 });
      }
      if (mark.position === "quarter" && midStrikes > 0) {
        events.push({ at: mark.at, position: "quarter", tone: toneAt("quarter"), strikes: midStrikes, gain: 0.5 });
      }
      if (mark.position === "threeQuarter" && midStrikes > 0) {
        events.push({ at: mark.at, position: "threeQuarter", tone: toneAt("threeQuarter"), strikes: midStrikes, gain: 0.5 });
      }
      if (mark.position === "end" && endStrikes > 0) {
        events.push({ at: mark.at, position: "end", tone: toneAt("end"), strikes: endStrikes, gain: 1 });
      }
    });
    return { minutes: clock.minutes, duration: clock.duration, midway: clock.midway, events: events };
  }

  function fromSettings(get) {
    const read = typeof get === "function" ? get : function () { return undefined; };
    return plan({
      minutes: read("sit.minutes"),
      midway: read("sit.midway"),
      start: read("bell.on") !== false,
      ending: read("bell.ending") !== false,
      startStrikes: read("bell.startStrikes"),
      midStrikes: read("bell.midStrikes"),
      endStrikes: read("bell.endStrikes"),
      sameTone: read("bell.sameTone") !== false,
      startTone: read("bell.startTone"),
      endTone: read("bell.endTone"),
      halfTone: read("bell.halfTone"),
      quarterTone: read("bell.quarterTone"),
      threeQuarterTone: read("bell.threeQuarterTone"),
    });
  }

  const api = {
    PRESETS: PRESETS,
    DEFAULT_MINUTES: DEFAULT_MINUTES,
    MAX_MINUTES: MAX_MINUTES,
    TONES: TONES,
    BEDS: BEDS,
    minutes: minutes,
    strikes: strikes,
    bellTimes: bellTimes,
    plan: plan,
    fromSettings: fromSettings,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraSit = api;
})(typeof window !== "undefined" ? window : null);
