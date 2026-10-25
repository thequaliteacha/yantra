/* Morning and evening reminders. The sun is calculated here. The server receives
   only a rounded place, or nothing but a clock time. */
import { findPlaces, parseCoords } from "./places.js";
import { COPY, fireAt, formatLocal, localDate, sanitizeSchedule } from "./schedule.js";

const KEY = "yantra.reminders.v1";
const OFFSETS = [
  [-60, "60 minutes before"],
  [-30, "30 minutes before"],
  [-15, "15 minutes before"],
  [0, "No offset"],
  [15, "15 minutes after"],
  [30, "30 minutes after"],
  [60, "60 minutes after"],
];

function lineFor(label, pref, solar) {
  if (!pref || !pref.on) return label + " off";
  if (pref.mode === "clock") {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(pref.time || "") ? pref.time : (label === "Evening" ? "19:00" : "06:30");
    return label + " on · " + time;
  }
  const sun = pref.mode === "sunset" || pref.mode === "sunrise" ? pref.mode : solar;
  let phrase = label + " on · " + sun;
  const offset = Number(pref.offset);
  if (Number.isFinite(offset) && offset !== 0) {
    const minutes = Math.abs(Math.round(offset));
    phrase += " · " + minutes + " minute" + (minutes === 1 ? "" : "s") + " " + (offset < 0 ? "before" : "after");
  }
  return phrase;
}

/* What the account page shows. It does not ask for notification permission. */
export function summaryLines(record) {
  const raw = record && typeof record === "object" ? record : {};
  return {
    morning: lineFor("Morning", raw.morning, "sunrise"),
    evening: lineFor("Evening", raw.evening, "sunset"),
  };
}

function load() {
  const settings = window.YantraSettings;
  if (settings) {
    const value = settings.get("reminders");
    if (value && typeof value === "object") return value;
    return {};
  }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw === "object") return raw;
  } catch (e) {}
  return {};
}

function save(record) {
  const settings = window.YantraSettings;
  if (settings) {
    settings.set("reminders", record);
    return;
  }
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch (e) {}
}

function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
}

function iosDevice() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.navigator.standalone === true;
}

function bytesFromKey(text) {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function anonId(record) {
  if (record.id && /^[0-9a-f-]{36}$/i.test(record.id)) return record.id;
  const id = crypto.randomUUID();
  record.id = id;
  return id;
}

function themeFromForm(theme) {
  const root = document.querySelector('#reminders [data-theme="' + theme + '"]');
  const on = root.querySelector("[data-on]").getAttribute("aria-pressed") === "true";
  const mode = root.querySelector("[data-mode]:checked").value;
  return {
    on,
    mode: mode === "clock" ? "clock" : (theme === "evening" ? "sunset" : "sunrise"),
    offset: Number(root.querySelector("[data-offset]").value) || 0,
    time: root.querySelector("[data-time]").value || (theme === "evening" ? "19:00" : "06:30"),
  };
}

function applyTheme(theme, pref) {
  const root = document.querySelector('#reminders [data-theme="' + theme + '"]');
  const on = !!(pref && pref.on);
  const button = root.querySelector("[data-on]");
  button.setAttribute("aria-pressed", String(on));
  button.textContent = on ? "On" : "Off";
  const mode = pref && pref.mode === "clock" ? "clock" : "sun";
  root.querySelector('[data-mode][value="' + mode + '"]').checked = true;
  root.querySelector("[data-offset]").value = String(pref && OFFSETS.some((row) => row[0] === Number(pref.offset)) ? pref.offset : 0);
  root.querySelector("[data-time]").value = pref && pref.time ? pref.time : (theme === "evening" ? "19:00" : "06:30");
  paintTheme(root);
}

function paintTheme(root) {
  const clock = root.querySelector("[data-mode][value='clock']").checked;
  root.querySelector("[data-offset]").disabled = clock;
  root.querySelector("[data-time]").disabled = !clock;
}

function placeLabel(place) {
  if (!place) return "";
  if (place.name) return place.name;
  if (place.lat != null) return Number(place.lat).toFixed(1) + ", " + Number(place.lon).toFixed(1);
  return "";
}

function cityPlace(match) {
  return { name: match.label, lat: match.lat, lon: match.lon, tz: match.tz, source: "city" };
}

function readPlace(record) {
  const field = document.getElementById("remind-place");
  const typed = field.value.trim();
  const coords = parseCoords(typed);
  if (coords) {
    return { name: coords.name, lat: coords.lat, lon: coords.lon, tz: deviceZone(), source: "coords" };
  }
  const matches = findPlaces(typed);
  const lower = typed.toLowerCase();
  // A chosen suggestion, a city typed in full, or the only city that fits.
  const exact = matches.find((place) => place.label.toLowerCase() === lower)
    || matches.find((place) => place.name.toLowerCase() === lower)
    || (matches.length === 1 ? matches[0] : null);
  if (exact) return cityPlace(exact);
  if (record.place && placeLabel(record.place) === typed) return record.place;
  return null;
}

function preview(record) {
  const place = readPlace(record) || record.place;
  const schedule = sanitizeSchedule({
    tz: place && place.tz ? place.tz : deviceZone(),
    lat: place ? place.lat : null,
    lon: place ? place.lon : null,
    morning: themeFromForm("morning"),
    evening: themeFromForm("evening"),
  });
  if (place && place.lat != null) {
    schedule.lat = place.lat;
    schedule.lon = place.lon;
  }
  const today = localDate(schedule.tz, Date.now());
  const bits = [];
  for (const theme of ["morning", "evening"]) {
    if (!schedule[theme].on) continue;
    let when = fireAt(schedule, theme, today);
    if (when != null && when <= Date.now()) when = fireAt(schedule, theme, nextDate(today));
    if (when == null) {
      bits.push(theme === "morning" ? "Morning needs a place, unless you set a time." : "Evening needs a place, unless you set a time.");
      continue;
    }
    bits.push((theme === "morning" ? "Morning" : "Evening") + " · " + formatLocal(when, schedule.tz));
  }
  document.getElementById("remind-next").textContent = bits.join("    ");
}

function nextDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function status(text) {
  document.getElementById("remind-status").textContent = text || "";
}

async function pushServer(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function saveReminders(record) {
  const morning = themeFromForm("morning");
  const evening = themeFromForm("evening");
  const place = readPlace(record);
  const needsPlace = (morning.on && morning.mode !== "clock") || (evening.on && evening.mode !== "clock");
  if (needsPlace && !place) {
    status("Type a city, coordinates such as 30.3, -97.7, or use where you are. A set time needs no place.");
    return;
  }
  record.place = place || record.place || null;
  record.morning = morning;
  record.evening = evening;
  record.tz = record.place && record.place.tz ? record.place.tz : deviceZone();
  save(record);
  preview(record);
  const wants = morning.on || evening.on;
  if (!wants) {
    if (record.id) {
      const sent = await pushServer("/push", payload(record, null));
      if (!sent.ok && sent.status !== 404) status(sent.data.error || "The reminder stayed on this device.");
      else status("Reminders are off.");
    } else status("Reminders are off.");
    return;
  }
  if (iosDevice() && !standalone()) {
    status("On iPhone and iPad, open Yantra from the Home Screen icon, then turn a reminder on there.");
    return;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    status("This browser cannot deliver reminders yet.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    status("Notifications stayed off. The choice is kept here for when you allow them.");
    return;
  }
  const key = await pushServer("/push/key");
  if (!key.ok || !key.data.publicKey) {
    status(key.data.error || "Reminders are not turned on for this site yet. The times stay on this device.");
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytesFromKey(key.data.publicKey),
    });
  }
  anonId(record);
  save(record);
  const sent = await pushServer("/push", payload(record, subscription.toJSON()));
  if (!sent.ok) {
    status(sent.data.error || "The reminder could not be saved.");
    return;
  }
  save(record);
  status("Saved on this device. A quiet note will arrive.");
}

function payload(record, subscription) {
  const place = record.place || {};
  return {
    id: anonId(record),
    subscription,
    tz: record.tz || deviceZone(),
    lat: place.lat,
    lon: place.lon,
    morning: record.morning,
    evening: record.evening,
  };
}

async function deleteReminders(record) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (e) {}
  if (record.id) await pushServer("/push/delete", { id: record.id }).catch(() => {});
  const settings = window.YantraSettings;
  if (settings) settings.set("reminders", {});
  else {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  const fresh = {};
  applyTheme("morning", fresh.morning);
  applyTheme("evening", fresh.evening);
  document.getElementById("remind-place").value = "";
  document.getElementById("remind-next").textContent = "";
  status("Reminder data deleted.");
  return fresh;
}

/* The suggestions are drawn as buttons under the field. A <datalist> shows
   nothing on iPhone, iPad and most Android browsers, so the list is our own. */
function paintSuggestions(query, onPick) {
  const list = document.getElementById("remind-places");
  list.replaceChildren();
  const typed = String(query || "").trim();
  const matches = findPlaces(typed);
  for (const place of matches) {
    if (place.label.toLowerCase() === typed.toLowerCase()) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remind-suggest";
    button.textContent = place.label;
    button.addEventListener("click", () => onPick(place));
    list.append(button);
  }
  if (!matches.length && typed.length >= 3 && !parseCoords(typed)) {
    const note = document.createElement("span");
    note.className = "remind-none";
    note.textContent = "Not in the list. Try the nearest city, or coordinates like 30.3, -97.7.";
    list.append(note);
  }
  list.hidden = !list.childElementCount;
}

function boot() {
  const root = document.getElementById("reminders");
  if (!root || !window.YANTRA_WEB) return;
  root.hidden = false;
  let record = load();
  applyTheme("morning", record.morning);
  applyTheme("evening", record.evening);
  document.getElementById("remind-place").value = placeLabel(record.place);
  const ios = document.getElementById("remind-ios");
  if (iosDevice() && !standalone()) {
    ios.hidden = false;
    ios.textContent = "On iPhone and iPad, reminders arrive only from the Home Screen app. Tap Share, then Add to Home Screen, and open Yantra from that icon.";
  } else {
    ios.hidden = true;
  }
  document.getElementById("remind-copy").textContent = "Morning: " + COPY.morning;
  preview(record);
  // Times chosen on a linked device arrive here. Notifications are allowed per
  // device, so this one only follows along once it has said yes itself.
  window.addEventListener("yantra:settings-merged", async (event) => {
    const keys = (event.detail && event.detail.keys) || [];
    if (keys.indexOf("reminders") < 0) return;
    record = load();
    applyTheme("morning", record.morning);
    applyTheme("evening", record.evening);
    document.getElementById("remind-place").value = placeLabel(record.place);
    preview(record);
    const wants = !!((record.morning && record.morning.on) || (record.evening && record.evening.on));
    let subscription = null;
    try {
      if ("serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        subscription = await registration.pushManager.getSubscription();
      }
    } catch (e) {}
    if (subscription && (wants || record.id)) {
      const sent = await pushServer("/push", payload(record, subscription.toJSON())).catch(() => ({ ok: false }));
      save(record);
      status(sent.ok ? "Reminder times updated from your linked device." : "");
    } else if (wants) {
      status("Reminder times came from your linked device. Tap Save reminders to get the notes here too.");
    }
  });
  root.addEventListener("change", () => preview(record));
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-on]");
    if (!button) return;
    const pressed = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(pressed));
    button.textContent = pressed ? "On" : "Off";
    preview(record);
  });
  const placeField = document.getElementById("remind-place");
  const pick = (place) => {
    placeField.value = place.label;
    paintSuggestions(place.label, pick);
    preview(record);
  };
  placeField.addEventListener("input", (event) => {
    paintSuggestions(event.target.value, pick);
    preview(record);
  });
  placeField.addEventListener("keydown", (event) => {
    // Enter takes the first suggestion, so a phone keyboard's Done can choose.
    if (event.key !== "Enter") return;
    const first = findPlaces(placeField.value)[0];
    if (first && !parseCoords(placeField.value)) {
      event.preventDefault();
      pick(first);
      placeField.blur();
    }
  });
  document.getElementById("remind-here").addEventListener("click", () => {
    if (!navigator.geolocation) {
      status("This browser has no location. Type a city or coordinates.");
      return;
    }
    status("Asking for a coarse place…");
    navigator.geolocation.getCurrentPosition((pos) => {
      record.place = {
        name: "Where I am",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        tz: deviceZone(),
        source: "here",
      };
      document.getElementById("remind-place").value = "Where I am";
      save(record);
      preview(record);
      status("Kept on this device. A rounded place is all that would be sent.");
    }, () => {
      status("Location stayed off. Type a city, or coordinates such as 21.3, -157.9.");
    }, { enableHighAccuracy: false, maximumAge: 600000, timeout: 12000 });
  });
  document.getElementById("remind-save").addEventListener("click", () => {
    saveReminders(record).catch(() => status("The reminder could not be saved."));
  });
  document.getElementById("remind-delete").addEventListener("click", () => {
    deleteReminders(record).then((fresh) => { record = fresh; }).catch(() => status("The reminder data could not be deleted."));
  });
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const theme = event.data && event.data.ready;
      if ((theme === "morning" || theme === "evening") && typeof window.openReadySit === "function") {
        window.openReadySit(theme);
      }
    });
  }
}

if (typeof window !== "undefined") window.YantraReminders = { load, summaryLines };

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
