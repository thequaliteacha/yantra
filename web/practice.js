/* Practice record for the web edition.
 *
 * A formal sit is a Morning Meditation or an Evening Meditation. It counts
 * after one minute of playback. Paused time is not included. Album listening
 * and Dharma talks stay in yantra.listening.v1 and never enter these totals
 * or streaks. The day is the device's local calendar. An evening sit before
 * 2:22 AM still belongs to the day before. Missing a morning ends
 * the morning run only. The weekly count is the daily run capped at 7.
 * It is derived when the page asks, never stored, and it does not start over.
 *
 * The days themselves stay in this browser. A device with no practice key
 * reads only those days. A linked device still records only its own sits
 * here; sync.js merges the other devices' days for the streaks and totals.
 * This file never asks to notify and never contacts a server.
 *
 * days keeps the history a later, calmer set of milestones can read.
 * milestones is reserved for those markers ({ id, earnedOn }), and stays
 * empty until then. reminders is reserved for an optional on-device nudge
 * ({ morning: "HH:MM", evening: "HH:MM" }).
 */
(function (root) {
  const KEY = "yantra.practice.v1";
  const PENDING_KEY = "yantra.listening.pendingEarlier";
  const MIN_MS = 60 * 1000;
  /* Evening keeps going past midnight. 00:00 up to 02:22 is still the previous day's sunset sit. */
  const EVENING_CARRY_MINUTES = 2 * 60 + 22;
  const RULE = "A minute of a morning or evening sit counts. Evening continues until 2:22 AM. Kept on this device only.";
  let pendingEarlier = 0;

  function empty() {
    return {
      version: 2,
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

  /* The practice date for a formal sit. Morning stays on the local calendar
     day. Evening before 2:22 AM belongs to the day before, so a sit finished
     after midnight still counts as that sunset. */
  function practiceDate(when, theme) {
    const d = when instanceof Date ? when : new Date();
    const day = localDate(d);
    if (theme !== "evening") return day;
    const minutes = d.getHours() * 60 + d.getMinutes();
    if (minutes < EVENING_CARRY_MINUTES) return addDays(day, -1);
    return day;
  }

  function sitTheme(heard) {
    return heard && (heard.theme === "morning" || heard.theme === "evening") ? heard.theme : "";
  }

  /* A live or open sit carries `at` (commit, or the last checkpoint). Date it
     from that moment so a midnight evening is not stuck on the wrong calendar
     day, and so opening the app the next morning does not move it. An explicit
     date with no moment is already a practice day: tests, sync, and stored
     history stay as they are. */
  function sitDate(heard) {
    const theme = sitTheme(heard);
    const at = heard && Number(heard.at);
    if (at > 0) return practiceDate(new Date(at), theme);
    if (heard && /^\d{4}-\d{2}-\d{2}$/.test(heard.date || "")) return heard.date;
    return practiceDate(new Date(), theme);
  }

  function dayBetween(earlier, later) {
    const [ay, am, ad] = earlier.split("-").map(Number);
    const [by, bm, bd] = later.split("-").map(Number);
    const a = Date.UTC(ay, am - 1, ad);
    const b = Date.UTC(by, bm - 1, bd);
    return Math.round((b - a) / 86400000);
  }

  function readDay(day) {
    const src = day || {};
    return {
      ms: Math.max(0, Number(src.ms) || 0),
      sits: Math.max(0, Number(src.sits) || 0),
      morning: Math.max(0, Number(src.morning) || 0),
      evening: Math.max(0, Number(src.evening) || 0),
      other: Math.max(0, Number(src.other) || 0),
    };
  }

  /* Formal shape of one day. A shelf-only day drops out. A mixed day keeps its
     unsplit milliseconds here and forgets the shelf count. */
  function projectDay(day) {
    const src = readDay(day);
    const formal = src.morning + src.evening;
    if (formal <= 0) return null;
    return {
      ms: src.ms,
      sits: formal,
      morning: src.morning,
      evening: src.evening,
    };
  }

  function normalizeDay(day) {
    return projectDay(day) || { ms: 0, sits: 0, morning: 0, evening: 0 };
  }

  function normalize(raw) {
    const store = empty();
    if (!raw || typeof raw !== "object") return store;
    const days = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(days).forEach((key) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const day = projectDay(days[key]);
      if (day) store.days[key] = day;
    });
    store.totals = totalsFromDays(store.days);
    store.milestones = Array.isArray(raw.milestones) ? raw.milestones.slice() : [];
    store.reminders = raw.reminders && typeof raw.reminders === "object" ? raw.reminders : null;
    if (raw.open && typeof raw.open === "object") {
      const theme = raw.open.theme === "morning" || raw.open.theme === "evening" ? raw.open.theme : "";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.open.date || "") ? raw.open.date : "";
      if (theme) {
        store.open = {
          ms: Math.max(0, Number(raw.open.ms) || 0),
          theme,
          date,
          at: Number(raw.open.at) || 0,
        };
      }
    }
    return store;
  }

  /* Milliseconds that belonged only to shelf listening, including an open
     album sit the page did not close. Mixed days stay in the formal total. */
  function earlierFrom(raw) {
    if (!raw || typeof raw !== "object") return 0;
    let ms = 0;
    const days = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(days).forEach((key) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const src = readDay(days[key]);
      if (src.morning + src.evening <= 0) ms += src.ms;
    });
    const open = raw.open;
    if (open && typeof open === "object") {
      const theme = open.theme === "morning" || open.theme === "evening" ? open.theme : "";
      if (!theme) ms += Math.max(0, Number(open.ms) || 0);
    }
    return ms;
  }

  function needsMigration(raw) {
    if (!raw || typeof raw !== "object") return false;
    if (Number(raw.version) !== 2) return true;
    if (earlierFrom(raw) > 0) return true;
    const days = raw.days && typeof raw.days === "object" ? raw.days : {};
    return Object.keys(days).some((key) => readDay(days[key]).other > 0);
  }

  function migrate(raw) {
    return {
      store: normalize(raw),
      earlierMs: earlierFrom(raw),
      changed: needsMigration(raw),
    };
  }

  function clone(store) {
    return normalize(JSON.parse(JSON.stringify(store)));
  }

  /* One row per device. The same device id is counted once, so pulling a log
     again, or listing a device twice, does not add the sits a second time.
     Different devices add. The day is the union; the counts are the sum.
     Keys are already practice dates. Merging does not move an evening sit. */
  function mergeDays(logs) {
    const out = {};
    const seen = new Set();
    (Array.isArray(logs) ? logs : []).forEach((log) => {
      if (!log || typeof log !== "object") return;
      const id = typeof log.deviceId === "string" ? log.deviceId : "";
      if (!id || seen.has(id)) return;
      seen.add(id);
      const days = log.days && typeof log.days === "object" ? log.days : {};
      Object.keys(days).forEach((date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const src = projectDay(days[date]);
        if (!src) return;
        const dst = out[date] ? projectDay(out[date]) : null;
        const next = dst || { ms: 0, sits: 0, morning: 0, evening: 0 };
        next.ms += src.ms;
        next.sits += src.sits;
        next.morning += src.morning;
        next.evening += src.evening;
        out[date] = next;
      });
    });
    return out;
  }

  function totalsFromDays(days) {
    const totals = { ms: 0, sits: 0 };
    const clean = days && typeof days === "object" ? days : {};
    Object.keys(clean).forEach((date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const day = projectDay(clean[date]);
      if (!day) return;
      totals.ms += day.ms;
      totals.sits += day.sits;
    });
    return totals;
  }

  let afterCommit = null;
  let afterErase = null;
  let viewOf = null;

  function onCommit(fn) { afterCommit = typeof fn === "function" ? fn : null; }
  function onErase(fn) { afterErase = typeof fn === "function" ? fn : null; }
  function setView(fn) { viewOf = typeof fn === "function" ? fn : null; }

  /* Local days when this device is on its own. The merged view when a practice
     key is set. A broken view falls back to the local record. */
  function loadView() {
    const local = load();
    if (!viewOf) return local;
    try {
      const viewed = viewOf(local);
      if (!viewed || typeof viewed !== "object") return local;
      return normalize(viewed);
    } catch (e) {
      return local;
    }
  }

  /* Qualifying sits of one kind, walked as calendar days. current is the run
     that still includes today or yesterday; best is the longest run stored. */
  function streakFor(days, kind, today) {
    const dates = Object.keys(days).filter((date) => {
      const day = days[date];
      if (!day) return false;
      if (kind === "daily") return day.morning > 0 || day.evening > 0;
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

  /* Weekly is the live daily run, and it stops at seven. Eight days in a row
     stays 7. It is not a remainder, and it is not a new stored streak. */
  function weeklyOf(continuous) {
    const n = Math.max(0, Math.floor(Number(continuous) || 0));
    if (n <= 0) return 0;
    return n < 7 ? n : 7;
  }

  function streaks(store, today, eveningToday) {
    const days = (store && store.days) || {};
    const evening = eveningToday || today;
    const daily = streakFor(days, "daily", today);
    return {
      morning: streakFor(days, "morning", today),
      evening: streakFor(days, "evening", evening),
      daily: daily,
      perfect: streakFor(days, "perfect", today),
      weekly: { current: weeklyOf(daily.current), cap: 7 },
    };
  }

  function record(store, heard) {
    const next = clone(store || empty());
    next.open = null;
    const ms = Math.max(0, Number(heard && heard.ms) || 0);
    const theme = sitTheme(heard);
    if (!theme || ms < MIN_MS) return { store: next, counted: false };
    const date = sitDate(heard);
    const day = projectDay(next.days[date]) || { ms: 0, sits: 0, morning: 0, evening: 0 };
    day.ms += ms;
    day[theme] += 1;
    day.sits = day.morning + day.evening;
    next.days[date] = day;
    next.totals = totalsFromDays(next.days);
    return { store: next, counted: true };
  }

  /* The last seven days, oldest first, each with its sunrise and sunset halves.
     The ring sits on the evening practice day, which is yesterday until 2:22. */
  function weekOf(store, today, eveningToday) {
    const mark = eveningToday || today;
    const out = [];
    for (let back = 6; back >= 0; back -= 1) {
      const date = addDays(today, -back);
      const day = normalizeDay(store.days[date]);
      out.push({ date: date, morning: day.morning > 0, evening: day.evening > 0, today: date === mark });
    }
    return out;
  }

  function summarize(store, now) {
    const clean = normalize(store);
    const when = now instanceof Date ? now : new Date();
    const todayKey = localDate(when);
    const eveningKey = practiceDate(when, "evening");
    const calendar = normalizeDay(clean.days[todayKey]);
    const eveningDay = normalizeDay(clean.days[eveningKey]);
    const same = todayKey === eveningKey;
    /* Morning stays on the calendar day. Evening before 2:22 still reads as
       this sunset, including its minutes. A perfect day is both sits on one
       date, so those halves are not paired across the boundary. */
    const today = same ? {
      ms: calendar.ms,
      sits: calendar.sits,
      morning: calendar.morning,
      evening: calendar.evening,
      eveningHere: true,
    } : {
      ms: calendar.ms + eveningDay.ms,
      sits: calendar.sits + eveningDay.evening,
      morning: calendar.morning,
      evening: eveningDay.evening,
      eveningHere: false,
    };
    return {
      totals: { ms: clean.totals.ms, sits: clean.totals.sits },
      today: today,
      streaks: streaks(clean, todayKey, eveningKey),
      week: weekOf(clean, todayKey, eveningKey),
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
    /* During the evening carry, today.evening is yesterday's sunset and must
       not pair with this calendar morning into a perfect day. */
    const evening = today.evening > 0 && today.eveningHere !== false;
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

  /* Home shows Start Here until this device has three completed sits in its own
     history. Pass the local record, not the merged view of linked devices. */
  const START_HERE_SITS = 3;
  function startHereDue(store) {
    const sits = Math.max(0, Number(store && store.totals && store.totals.sits) || 0);
    return sits < START_HERE_SITS;
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
    let ms = 0;
    let last = null;
    let on = false;
    function heardNow() {
      const at = clock();
      return { ms: ms, theme: theme, at: at, date: practiceDate(new Date(at), theme) };
    }
    return {
      begin(nextTheme) {
        theme = nextTheme === "morning" || nextTheme === "evening" ? nextTheme : "";
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
      snapshot() { return heardNow(); },
      end() {
        const heard = heardNow();
        on = false;
        ms = 0;
        last = null;
        theme = "";
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

  function handoffEarlier(ms) {
    const add = Math.max(0, Number(ms) || 0);
    if (!add) return;
    const Listening = root && root.YantraListening;
    if (Listening && typeof Listening.absorbEarlier === "function") {
      Listening.absorbEarlier(add);
      return;
    }
    const kept = storage();
    if (!kept) {
      pendingEarlier += add;
      return;
    }
    const prev = Math.max(0, Number(kept.getItem(PENDING_KEY) || "0") || 0);
    try { kept.setItem(PENDING_KEY, String(prev + add)); }
    catch (e) { pendingEarlier += add; }
  }

  function takeMigratedEarlier() {
    let ms = pendingEarlier;
    pendingEarlier = 0;
    const kept = storage();
    if (kept) {
      ms += Math.max(0, Number(kept.getItem(PENDING_KEY) || "0") || 0);
      try { kept.removeItem(PENDING_KEY); } catch (e) {}
    }
    return ms;
  }

  function load() {
    const kept = storage();
    if (!kept) return empty();
    try {
      const raw = JSON.parse(kept.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object") return empty();
      if (needsMigration(raw)) {
        const earlierMs = earlierFrom(raw);
        const store = normalize(raw);
        save(store);
        handoffEarlier(earlierMs);
        return store;
      }
      return normalize(raw);
    } catch (e) { return empty(); }
  }

  function save(store) {
    const kept = storage();
    if (!kept) return;
    try { kept.setItem(KEY, JSON.stringify(normalize(store))); } catch (e) {}
  }

  function commit(heard) {
    const result = record(load(), heard);
    save(result.store);
    if (result.counted && afterCommit) {
      try { afterCommit(result); } catch (e) {}
    }
    return result;
  }

  function checkpoint(heard) {
    if (!heard) return;
    const theme = heard.theme === "morning" || heard.theme === "evening" ? heard.theme : "";
    if (!theme) return;
    const store = load();
    const at = Number(heard.at) > 0 ? Number(heard.at) : Date.now();
    store.open = {
      ms: Math.max(0, Number(heard.ms) || 0),
      theme: theme,
      date: practiceDate(new Date(at), theme),
      at: at,
    };
    save(store);
  }

  /* A sit the page did not get to close (the phone locked and the app was
     released) is kept on the next open. The day is the practice date at the
     last checkpoint, so an evening before 2:22 AM stays on the day before
     even when the phone is opened later that morning. */
  function recover() {
    const store = load();
    if (!store.open) return store;
    const open = store.open;
    const result = record(store, open);
    save(result.store);
    if (result.counted && afterCommit) {
      try { afterCommit(result); } catch (e) {}
    }
    return result.store;
  }

  function erase() {
    const kept = storage();
    if (!kept) return;
    try { kept.removeItem(KEY); } catch (e) {}
    if (afterErase) {
      try { afterErase(); } catch (e) {}
    }
  }

  function summary() {
    return summarize(loadView(), new Date());
  }

  function exportData() {
    const store = loadView();
    const picture = summarize(store, new Date());
    return {
      app: "yantra",
      version: 1,
      exported: new Date().toISOString(),
      totals: picture.totals,
      today: {
        ms: picture.today.ms,
        sits: picture.today.sits,
        morning: picture.today.morning,
        evening: picture.today.evening,
      },
      days: store.days,
      streaks: picture.streaks,
      milestones: store.milestones,
      reminders: store.reminders,
      rules: {
        minimumMs: MIN_MS,
        listening: "Playback time only. Paused time is not counted.",
        streaks: "A perfect day has a morning sit and an evening sit; the perfect run counts those days. Morning and evening are separate runs. A missed morning ends only the morning run. The daily run counts a day with a morning or an evening sit. The weekly count is that daily run capped at 7, derived and not stored, and it stays at 7 after the seventh day. Album and talk listening are a separate total and do not extend a run. Dates are the device's local calendar. An evening sit before 2:22 AM still belongs to the day before.",
        milestones: "Reserved. Empty until a later version marks them.",
        reminders: "Reserved. This version does not notify.",
      },
    };
  }

  const api = {
    KEY: KEY,
    PENDING_KEY: PENDING_KEY,
    MIN_MS: MIN_MS,
    RULE: RULE,
    empty: empty,
    normalize: normalize,
    migrate: migrate,
    earlierFrom: earlierFrom,
    takeMigratedEarlier: takeMigratedEarlier,
    localDate: localDate,
    practiceDate: practiceDate,
    addDays: addDays,
    record: record,
    mergeDays: mergeDays,
    totalsFromDays: totalsFromDays,
    streaks: streaks,
    weeklyOf: weeklyOf,
    summarize: summarize,
    onCommit: onCommit,
    onErase: onErase,
    setView: setView,
    loadView: loadView,
    formatMinutes: formatMinutes,
    formatSpan: formatSpan,
    lead: lead,
    START_HERE_SITS: START_HERE_SITS,
    startHereDue: startHereDue,
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
