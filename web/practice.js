/* Practice record for the web edition. Everything stays in this browser.
 *
 * A sit counts after one minute of playback. Paused time is not included.
 * Morning and evening are the sits the listener chose on the home screen;
 * a sit from the shelf counts only toward the daily run. The day is the
 * device's local calendar. Missing a morning ends the morning run only.
 *
 * days keeps the history a later, calmer set of milestones can read.
 * milestones is reserved for those markers ({ id, earnedOn }), and stays
 * empty until then. reminders is reserved for an optional on-device nudge
 * ({ morning: "HH:MM", evening: "HH:MM" }); this version never asks to
 * notify and never contacts a server.
 */
(function (root) {
  const KEY = "yantra.practice.v1";
  const MIN_MS = 60 * 1000;
  const RULE = "A minute of listening counts as a sit. Kept on this device only.";

  function empty() {
    return {
      version: 1,
      totals: { ms: 0, sits: 0 },
      days: {},
      milestones: [],
      reminders: null,
      open: null,
    };
  }

  function localDate(date) {
    const d = date instanceof Date ? date : new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function addDays(iso, n) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !part && part !== 0)) return "";
    const next = new Date(parts[0], parts[1] - 1, parts[2] + n);
    return localDate(next);
  }

  function dayBetween(earlier, later) {
    const [ay, am, ad] = earlier.split("-").map(Number);
    const [by, bm, bd] = later.split("-").map(Number);
    const a = Date.UTC(ay, am - 1, ad);
    const b = Date.UTC(by, bm - 1, bd);
    return Math.round((b - a) / 86400000);
  }

  function normalizeDay(day) {
    const src = day || {};
    return {
      ms: Math.max(0, Number(src.ms) || 0),
      sits: Math.max(0, Number(src.sits) || 0),
      morning: Math.max(0, Number(src.morning) || 0),
      evening: Math.max(0, Number(src.evening) || 0),
      other: Math.max(0, Number(src.other) || 0),
    };
  }

  function normalize(raw) {
    const store = empty();
    if (!raw || typeof raw !== "object") return store;
    store.totals.ms = Math.max(0, Number(raw.totals && raw.totals.ms) || 0);
    store.totals.sits = Math.max(0, Number(raw.totals && raw.totals.sits) || 0);
    const days = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(days).forEach((key) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      store.days[key] = normalizeDay(days[key]);
    });
    store.milestones = Array.isArray(raw.milestones) ? raw.milestones.slice() : [];
    store.reminders = raw.reminders && typeof raw.reminders === "object" ? raw.reminders : null;
    if (raw.open && typeof raw.open === "object") {
      const theme = raw.open.theme === "morning" || raw.open.theme === "evening" ? raw.open.theme : "";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.open.date || "") ? raw.open.date : "";
      store.open = {
        ms: Math.max(0, Number(raw.open.ms) || 0),
        theme,
        date,
        at: Number(raw.open.at) || 0,
      };
    }
    return store;
  }

  function clone(store) {
    return normalize(JSON.parse(JSON.stringify(store)));
  }

  /* Qualifying sits of one kind, walked as calendar days. current is the run
     that still includes today or yesterday; best is the longest run stored. */
  function streakFor(days, kind, today) {
    const dates = Object.keys(days).filter((date) => {
      const day = days[date];
      if (!day) return false;
      if (kind === "daily") return day.sits > 0;
      // A perfect day holds both sits: one at sunrise (morning) and one at sunset (evening).
      if (kind === "perfect") return day.morning > 0 && day.evening > 0;
      return (day[kind] || 0) > 0;
    }).sort();
    let best = 0;
    let run = 0;
    let prev = "";
    dates.forEach((date) => {
      run = prev && dayBetween(prev, date) === 1 ? run + 1 : 1;
      prev = date;
      if (run > best) best = run;
    });
    const last = dates.length ? dates[dates.length - 1] : "";
    let current = 0;
    if (last && (last === today || last === addDays(today, -1))) {
      current = 1;
      let cursor = last;
      const have = new Set(dates);
      while (have.has(addDays(cursor, -1))) {
        current += 1;
        cursor = addDays(cursor, -1);
      }
    }
    return { current, best, last };
  }

  function streaks(store, today) {
    const days = (store && store.days) || {};
    return {
      morning: streakFor(days, "morning", today),
      evening: streakFor(days, "evening", today),
      daily: streakFor(days, "daily", today),
      perfect: streakFor(days, "perfect", today),
    };
  }

  function record(store, heard) {
    const next = clone(store || empty());
    next.open = null;
    const ms = Math.max(0, Number(heard && heard.ms) || 0);
    if (ms < MIN_MS) return { store: next, counted: false };
    const date = (heard && /^\d{4}-\d{2}-\d{2}$/.test(heard.date || "")) ? heard.date : localDate(new Date());
    const theme = heard && (heard.theme === "morning" || heard.theme === "evening") ? heard.theme : "other";
    const day = normalizeDay(next.days[date]);
    day.ms += ms;
    day.sits += 1;
    day[theme] += 1;
    next.days[date] = day;
    next.totals.ms += ms;
    next.totals.sits += 1;
    return { store: next, counted: true };
  }

  function summarize(store, now) {
    const clean = normalize(store);
    const todayKey = localDate(now instanceof Date ? now : new Date());
    const today = normalizeDay(clean.days[todayKey]);
    return {
      totals: { ms: clean.totals.ms, sits: clean.totals.sits },
      today: { ms: today.ms, sits: today.sits, morning: today.morning, evening: today.evening },
      streaks: streaks(clean, todayKey),
      milestones: clean.milestones.slice(),
      reminders: clean.reminders,
    };
  }

  function formatMinutes(ms) {
    const min = Math.round((Number(ms) || 0) / 60000);
    if (min <= 0) return "None yet";
    if (min === 1) return "1 minute";
    return min + " minutes";
  }

  function formatSpan(ms) {
    const total = Math.round((Number(ms) || 0) / 60000);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours <= 0) return total === 1 ? "1 minute" : total + " minutes";
    const hourLabel = hours === 1 ? "1 hour" : hours + " hours";
    if (minutes === 0) return hourLabel;
    return hourLabel + " " + (minutes === 1 ? "1 minute" : minutes + " minutes");
  }

  /* Where today stands toward a perfect day (a sunrise sit and a sunset sit), and the
     run of perfect days it keeps. One warm line; it never scolds. */
  function perfectLine(summary) {
    const run = (summary.streaks && summary.streaks.perfect) || {};
    const current = run.current || 0;
    const today = summary.today || {};
    const morning = today.morning > 0;
    const evening = today.evening > 0;
    if (morning && evening) {
      if (current >= 3 && current >= (run.best || 0)) return current + " perfect days in a row, your longest yet.";
      if (current >= 2) return current + " perfect days in a row.";
      return "A perfect day: sunrise and sunset.";
    }
    // Until today is whole, current is the run through yesterday.
    const next = current + 1;
    if (morning) return next >= 2 ? "Sit at sunset for " + next + " perfect days in a row." : "Sit at sunset for a perfect day.";
    if (evening) return "Sunrise and sunset tomorrow make a perfect day.";
    return next >= 2 ? "Sit at sunrise and sunset for " + next + " perfect days in a row." : "Sit at sunrise and sunset for a perfect day.";
  }

  function lead(summary) {
    if (!summary || !summary.totals || summary.totals.sits < 1) {
      return "Sit at sunrise and sunset for a perfect day. Your time and streak begin here.";
    }
    return perfectLine(summary);
  }

  /* The line on the Meditation Complete screen: today's time, then the way to a perfect day. */
  function completeLine(summary, theme) {
    const todayMs = summary && summary.today ? summary.today.ms : 0;
    const minutes = Math.round((Number(todayMs) || 0) / 60000);
    const today = minutes <= 0 ? "" : "Today, " + (minutes === 1 ? "1 minute" : minutes + " minutes") + ".";
    let row = "";
    if (summary && summary.today && (theme === "morning" || theme === "evening")) row = perfectLine(summary);
    else {
      const daily = summary && summary.streaks && summary.streaks.daily ? summary.streaks.daily.current : 0;
      if (daily >= 2) row = daily + " days in a row.";
    }
    return [today, row].filter(Boolean).join(" ");
  }

  /* Map a track's loudness onto the same gentle range as the built-in breath,
     using the track's own quiet and loud parts so a soft album still moves. */
  function shapeLevels(rms) {
    const values = Array.from(rms || []).map((value) => Math.max(0, Number(value) || 0));
    if (!values.length) return [];
    const sorted = values.slice().sort((a, b) => a - b);
    const at = (portion) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * portion)))];
    const lo = at(0.1);
    const span = Math.max(at(0.9) - lo, 1e-6);
    return values.map((value) => {
      const unit = Math.max(0, Math.min(1, (value - lo) / span));
      return 0.12 + unit * 0.42;
    });
  }

  function envelopeFromChannel(channel, sampleRate, rate) {
    const channels = channel && typeof channel[0] === "object" ? channel : [channel];
    const data = channels[0];
    const length = data ? data.length : 0;
    const width = channels.length || 1;
    const perSecond = rate > 0 ? rate : 8;
    const hop = Math.max(1, Math.round((sampleRate || 44100) / perSecond));
    if (!length) return { rate: perSecond, values: [] };
    const stride = Math.max(1, Math.floor(hop / 256));
    const bins = Math.ceil(length / hop);
    const raw = new Array(bins);
    for (let bin = 0; bin < bins; bin += 1) {
      const start = bin * hop;
      const end = Math.min(length, start + hop);
      let sum = 0;
      let count = 0;
      for (let i = start; i < end; i += stride) {
        let sample = 0;
        for (let c = 0; c < width; c += 1) sample += (channels[c] && channels[c][i]) || 0;
        sample /= width;
        sum += sample * sample;
        count += 1;
      }
      raw[bin] = count ? Math.sqrt(sum / count) : 0;
    }
    return { rate: perSecond, values: shapeLevels(raw) };
  }

  /* Playback clock. position is seconds. A forward seek does not count as
     sitting; time the music was actually moving does, including while the
     screen is locked, because the gap is taken from the player position. */
  function createListeningClock(now) {
    const clock = now || function () { return Date.now(); };
    let theme = "";
    let date = "";
    let ms = 0;
    let last = null;
    let on = false;
    return {
      begin(nextTheme) {
        theme = nextTheme === "morning" || nextTheme === "evening" ? nextTheme : "";
        date = localDate(new Date(clock()));
        ms = 0;
        last = null;
        on = true;
      },
      active() { return on; },
      observe(sample) {
        if (!on || !sample) return;
        const at = sample.at == null ? clock() : sample.at;
        if (last && last.playing && last.key === sample.key && typeof sample.position === "number" && typeof last.position === "number") {
          const moved = sample.position - last.position;
          const wall = (at - last.at) / 1000;
          if (moved > 0 && wall >= 0) {
            const counted = moved > wall + 1.5 ? wall : moved;
            if (counted > 0) ms += counted * 1000;
          }
        }
        last = { key: sample.key, position: sample.position, playing: !!sample.playing, at: at };
      },
      snapshot() { return { ms: ms, theme: theme, date: date }; },
      end() {
        const heard = { ms: ms, theme: theme, date: date };
        on = false;
        ms = 0;
        last = null;
        theme = "";
        date = "";
        return heard;
      },
    };
  }

  function storage() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function load() {
    const kept = storage();
    if (!kept) return empty();
    try { return normalize(JSON.parse(kept.getItem(KEY) || "null")); } catch (e) { return empty(); }
  }

  function save(store) {
    const kept = storage();
    if (!kept) return;
    try { kept.setItem(KEY, JSON.stringify(normalize(store))); } catch (e) {}
  }

  function commit(heard) {
    const result = record(load(), heard);
    save(result.store);
    return result;
  }

  function checkpoint(heard) {
    if (!heard) return;
    const store = load();
    store.open = {
      ms: Math.max(0, Number(heard.ms) || 0),
      theme: heard.theme === "morning" || heard.theme === "evening" ? heard.theme : "",
      date: /^\d{4}-\d{2}-\d{2}$/.test(heard.date || "") ? heard.date : localDate(new Date()),
      at: Date.now(),
    };
    save(store);
  }

  /* A sit the page did not get to close (the phone locked and the app was
     released) is kept on the next open, credited to the day it started. */
  function recover() {
    const store = load();
    if (!store.open) return store;
    const open = store.open;
    const result = record(store, open);
    save(result.store);
    return result.store;
  }

  function erase() {
    const kept = storage();
    if (!kept) return;
    try { kept.removeItem(KEY); } catch (e) {}
  }

  function summary() {
    return summarize(load(), new Date());
  }

  function exportData() {
    const store = load();
    const picture = summarize(store, new Date());
    return {
      app: "yantra",
      version: 1,
      exported: new Date().toISOString(),
      totals: picture.totals,
      today: picture.today,
      days: store.days,
      streaks: picture.streaks,
      milestones: store.milestones,
      reminders: store.reminders,
      rules: {
        minimumMs: MIN_MS,
        listening: "Playback time only. Paused time is not counted.",
        streaks: "A perfect day has a morning sit and an evening sit; the perfect run counts those days. Morning and evening are separate runs. A missed morning ends only the morning run. The daily run counts a day with either. Shelf sits count toward the daily run only. Dates are the device's local calendar.",
        milestones: "Reserved. Empty until a later version marks them.",
        reminders: "Reserved. This version does not notify.",
      },
    };
  }

  const api = {
    KEY: KEY,
    MIN_MS: MIN_MS,
    RULE: RULE,
    empty: empty,
    normalize: normalize,
    localDate: localDate,
    addDays: addDays,
    record: record,
    streaks: streaks,
    summarize: summarize,
    formatMinutes: formatMinutes,
    formatSpan: formatSpan,
    lead: lead,
    completeLine: completeLine,
    shapeLevels: shapeLevels,
    envelopeFromChannel: envelopeFromChannel,
    createListeningClock: createListeningClock,
    load: load,
    save: save,
    commit: commit,
    checkpoint: checkpoint,
    recover: recover,
    erase: erase,
    summary: summary,
    exportData: exportData,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraPractice = api;
})(typeof window !== "undefined" ? window : null);
