/* When a reminder is due. Sunrise and sunset come from solar.js.
   The worker and the page share this so a coarse place still fires on time. */
import { sunTimes } from "./solar.js";

export const COPY = {
  morning: "The morning light is here. A few minutes of stillness?",
  evening: "The evening has come. A few minutes of stillness?",
};

const GRACE_MS = 3 * 60 * 1000;
const OFFSETS = [-60, -30, -15, 0, 15, 30, 60];

export function roundCoord(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

export function tzOffsetMs(timeZone, utcMs) {
  const map = {};
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  let hour = Number(map.hour);
  let day = Number(map.day);
  if (hour === 24) {
    hour = 0;
    day += 1;
  }
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, day, hour, Number(map.minute), Number(map.second));
  return asUtc - utcMs;
}

export function zonedToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = guess - tzOffsetMs(timeZone, guess);
  const again = guess - tzOffsetMs(timeZone, utc);
  if (again !== utc) utc = again;
  return utc;
}

export function localDate(timeZone, utcMs) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcMs));
}

export function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatLocal(utcMs, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(utcMs));
}

function clockTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "") ? value : fallback;
}

function safeZone(tz) {
  if (typeof tz !== "string" || tz.length === 0 || tz.length >= 80) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return tz;
  } catch (e) {
    return "UTC";
  }
}

function prefOf(raw, theme) {
  const source = raw && typeof raw === "object" ? raw : {};
  const offset = OFFSETS.includes(Number(source.offset)) ? Number(source.offset) : 0;
  const solarMode = theme === "evening" ? "sunset" : "sunrise";
  const mode = source.mode === "clock" ? "clock" : solarMode;
  return {
    on: !!source.on,
    mode,
    offset,
    time: clockTime(source.time, theme === "evening" ? "19:00" : "06:30"),
  };
}

/* What may be stored. Coordinates are rounded. Precise location never lands here. */
export function sanitizeSchedule(input) {
  const raw = input && typeof input === "object" ? input : {};
  const tz = safeZone(raw.tz);
  let lat = roundCoord(raw.lat);
  let lon = roundCoord(raw.lon);
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    lat = null;
    lon = null;
  }
  return {
    tz,
    lat,
    lon,
    morning: prefOf(raw.morning, "morning"),
    evening: prefOf(raw.evening, "evening"),
  };
}

export function fireAt(record, theme, date) {
  const pref = record && record[theme];
  if (!pref || !pref.on || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (pref.mode === "clock") {
    const [hour, minute] = pref.time.split(":").map(Number);
    return zonedToUtc(year, month, day, hour, minute, record.tz || "UTC");
  }
  if (record.lat == null || record.lon == null) return null;
  const noon = zonedToUtc(year, month, day, 12, 0, record.tz || "UTC");
  const times = sunTimes(noon, record.lat, record.lon);
  if (!times) return null;
  const base = pref.mode === "sunset" ? times.sunset : times.sunrise;
  return base + (Number(pref.offset) || 0) * 60000;
}

/* Reminders whose moment has just arrived and has not been sent for that local date. */
export function dueReminders(record, nowMs) {
  if (!record || !record.tz) return [];
  const today = localDate(record.tz, nowMs);
  const dates = [addDays(today, -1), today, addDays(today, 1)];
  const sent = record.sent || {};
  const due = [];
  for (const theme of ["morning", "evening"]) {
    for (const date of dates) {
      if (sent[theme] === date) continue;
      const at = fireAt(record, theme, date);
      if (at == null) continue;
      if (nowMs >= at && nowMs - at < GRACE_MS) {
        due.push({ theme, date, at });
        break;
      }
    }
  }
  return due;
}

/* The soonest fire still ahead, including one sitting inside the grace window. */
export function nextFire(record, nowMs) {
  if (!record || !record.tz) return null;
  const today = localDate(record.tz, nowMs);
  const sent = record.sent || {};
  let best = null;
  for (let i = -1; i <= 3; i += 1) {
    const date = addDays(today, i);
    for (const theme of ["morning", "evening"]) {
      if (sent[theme] === date) continue;
      const at = fireAt(record, theme, date);
      if (at == null || at <= nowMs - GRACE_MS) continue;
      if (!best || at < best.at) best = { theme, date, at };
    }
  }
  return best;
}

export function notificationFor(theme) {
  const evening = theme === "evening";
  return {
    title: evening ? "Evening" : "Morning",
    body: evening ? COPY.evening : COPY.morning,
    theme: evening ? "evening" : "morning",
    url: "/web/?ready=" + (evening ? "evening" : "morning"),
  };
}
