/* One store for this device. Each setting is { value, updatedAt } under
   yantra.settings.v1. The practice record stays in yantra.practice.v1. */
(function (root) {
  const KEY = "yantra.settings.v1";
  const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){0,4}$/;
  const GREETINGS = ["none", "hello", "time"];
  const LEVELS = ["", "sangha", "zazen"];
  const BEDS = ["silent", "white", "pink", "brown", "rain-light", "rain-steady", "rain-roof", "rain-thunder", "drone", "bowl", "pad"];
  const DEFAULTS = {
    "profile.name": "",
    "profile.greeting": "none",
    "access.level": "",
    "talks.saved": [],
    "talks.progress": {},
    "welcome.seen": false,
    "altar.photos": [],
    "altar.show": true,
    "reminders": {},
    "theme.light": false,
    "glow.level": null,
    "account.preferredMethod": "telegram",
    "flags.accountSync": false,
    "flags.accountSignOut": false,
    "sit.minutes": 15,
    "sit.midway": "none",
    "sit.background": "silent",
    "sit.bedVolume": 0.35,
    "bell.on": true,
    "bell.volume": 0.7,
    "bell.ending": true,
    "bell.sameTone": true,
    "bell.startTone": "medium",
    "bell.startStrikes": null,
    "bell.midStrikes": null,
    "bell.endStrikes": null,
    "bell.endTone": "medium",
    "bell.midTone": null,
    "bell.halfTone": "medium",
    "bell.quarterTone": "medium",
    "bell.threeQuarterTone": "medium",
    "glow.levelDark": null,
    "glow.levelLight": null,
    "motion.awakening": true,
  };
  const LEGACY = ["yantra.profile.v1", "yantra.reminders.v1", "yantra.glow"];
  /* What a linked device shares. The look of each screen (theme, brightness), the
     access word, and this device's reminder id stay on the device. */
  const SHARED = [
    "profile.name", "profile.greeting", "altar.photos", "altar.show",
    "talks.saved", "talks.progress", "reminders", "welcome.seen",
    "sit.minutes", "sit.midway", "sit.background", "sit.bedVolume",
  ];
  const listeners = new Set();

  function browserStore() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function clone(value) {
    if (value === null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function cleanName(value) {
    return String(value || "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  function readJson(store, key) {
    try {
      const raw = JSON.parse(store.getItem(key) || "null");
      return raw && typeof raw === "object" ? raw : null;
    } catch (e) {
      return null;
    }
  }

  function read(store) {
    const raw = readJson(store, KEY);
    return raw && !Array.isArray(raw) ? raw : {};
  }

  function write(store, raw) {
    store.setItem(KEY, JSON.stringify(raw));
  }

  function envelope(value) {
    return { value: clone(value), updatedAt: Date.now() };
  }

  function known(key, value) {
    if (key === "profile.name") return cleanName(value);
    if (key === "profile.greeting") return GREETINGS.indexOf(value) >= 0 ? value : "none";
    if (key === "access.level") return LEVELS.indexOf(value) >= 0 ? value : "";
    if (key === "talks.saved") {
      const list = Array.isArray(value) ? value : [];
      const ids = [];
      list.forEach((id) => {
        if (typeof id === "string" && /^[\w.-]{1,80}$/.test(id) && ids.indexOf(id) < 0) ids.push(id);
      });
      return ids.slice(0, 200);
    }
    if (key === "bell.startStrikes" || key === "bell.midStrikes" || key === "bell.endStrikes") {
      if (value === null || value === undefined || value === "") return null;
      const count = Number(value);
      if (count === 0 || count === 1 || count === 2 || count === 3 || count === 4) return count;
      return null;
    }
    if (key === "bell.startTone" || key === "bell.endTone" || key === "bell.halfTone" || key === "bell.quarterTone" || key === "bell.threeQuarterTone") {
      return value === "small" || value === "medium" || value === "deep" ? value : "medium";
    }
    if (key === "sit.minutes") {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(number) || number < 1 || number > 90) return 15;
      return number;
    }
    if (key === "sit.background") {
      if (value === "rain") return "rain-steady";
      return BEDS.indexOf(value) >= 0 ? value : "silent";
    }
    if (key === "sit.bedVolume") {
      const level = Number(value);
      if (!Number.isFinite(level)) return 0.35;
      return Math.max(0, Math.min(1, level));
    }
    if (key === "theme.light" || key === "flags.accountSync" || key === "flags.accountSignOut") return !!value;
    if (key === "motion.awakening") return value !== false && value !== "off";
    if (key === "glow.level" || key === "glow.levelLight" || key === "glow.levelDark") {
      if (value === null || value === undefined || value === "") return null;
      const level = Number(value);
      if (!Number.isFinite(level)) return null;
      return Math.max(0, Math.min(200, Math.round(level)));
    }
    if (key === "account.preferredMethod") {
      const method = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
      return method || "telegram";
    }
    if (key === "talks.progress") {
      // Where each talk was left: { "/talks/x.mp3": { at: seconds, done: bool } }.
      const out = {};
      const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      Object.keys(src).slice(0, 200).forEach((path) => {
        if (!/^\/talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/.test(path) || path.includes("..")) return;
        const entry = src[path] || {};
        out[path] = { at: Math.max(0, Math.round(Number(entry.at) || 0)), done: entry.done === true };
      });
      return out;
    }
    if (key === "welcome.seen") return value === true;
    if (key === "altar.show") return value !== false;
    if (key === "altar.photos") {
      // Up to six small photos for the altar, kept only on this device as JPEG data.
      const list = Array.isArray(value) ? value : [];
      return list
        .filter((src) => typeof src === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(src) && src.length < 240000)
        .slice(0, 6);
    }
    if (key === "reminders") {
      return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
    }
    return clone(value);
  }

  /* Move the older loose keys into the store, then drop them. Practice is left alone. */
  function migrate(store) {
    const kept = store || browserStore();
    if (!kept) return {};
    const raw = read(kept);
    let changed = false;
    const profile = readJson(kept, "yantra.profile.v1");
    if (profile && !raw["profile.name"]) {
      raw["profile.name"] = envelope(cleanName(profile.name));
      raw["profile.greeting"] = envelope(GREETINGS.indexOf(profile.greeting) >= 0 ? profile.greeting : "none");
      changed = true;
    }
    const reminders = readJson(kept, "yantra.reminders.v1");
    if (reminders && !raw.reminders) {
      raw.reminders = envelope(reminders);
      changed = true;
    }
    const glow = readJson(kept, "yantra.glow");
    if (glow && !raw["glow.level"] && !raw["theme.light"]) {
      if (glow.level !== undefined && glow.level !== null) raw["glow.level"] = envelope(known("glow.level", glow.level));
      raw["theme.light"] = envelope(!!glow.light);
      changed = true;
    }
    LEGACY.forEach((key) => {
      if (kept.getItem(key) != null) kept.removeItem(key);
    });
    if (changed) write(kept, raw);
    return raw;
  }

  function get(key, store) {
    const kept = store || browserStore();
    if (!kept) return key in DEFAULTS ? clone(DEFAULTS[key]) : undefined;
    const raw = migrate(kept);
    const entry = raw[key];
    if (entry && typeof entry === "object" && "value" in entry) return clone(entry.value);
    return key in DEFAULTS ? clone(DEFAULTS[key]) : undefined;
  }

  function set(key, value, store) {
    if (!KEY_RE.test(key)) return get(key, store);
    const kept = store || browserStore();
    const clean = known(key, value);
    if (!kept) return clean;
    const raw = migrate(kept);
    raw[key] = envelope(clean);
    write(kept, raw);
    listeners.forEach((fn) => {
      try { fn(key, clone(clean)); } catch (e) {}
    });
    return clean;
  }

  function subscribe(keyOrFn, maybeFn) {
    const key = typeof keyOrFn === "function" ? "*" : keyOrFn;
    const fn = typeof keyOrFn === "function" ? keyOrFn : maybeFn;
    const wrapped = (changed, value, info) => {
      if (key === "*" || key === changed) fn(changed, value, info);
    };
    listeners.add(wrapped);
    return function unsubscribe() { listeners.delete(wrapped); };
  }

  function entries(store) {
    const kept = store || browserStore();
    const raw = kept ? migrate(kept) : {};
    const names = Object.keys(DEFAULTS);
    Object.keys(raw).forEach((key) => {
      if (names.indexOf(key) < 0) names.push(key);
    });
    const out = {};
    names.forEach((key) => {
      const entry = raw[key];
      if (entry && typeof entry === "object" && "value" in entry) {
        out[key] = { value: clone(entry.value), updatedAt: Number(entry.updatedAt) || 0 };
      } else if (key in DEFAULTS) {
        out[key] = { value: clone(DEFAULTS[key]), updatedAt: null };
      }
    });
    return out;
  }

  function erase(store) {
    const kept = store || browserStore();
    if (!kept) return;
    kept.removeItem(KEY);
    LEGACY.forEach((key) => kept.removeItem(key));
    listeners.forEach((fn) => {
      try { fn("*", null); } catch (e) {}
    });
  }

  /* Shared settings this device has chosen, each with the time it was chosen. */
  function sharedEntries(store) {
    const kept = store || browserStore();
    const raw = kept ? migrate(kept) : {};
    const out = {};
    SHARED.forEach((key) => {
      const entry = raw[key];
      const at = entry && typeof entry === "object" ? Number(entry.updatedAt) || 0 : 0;
      if (!at || !("value" in entry)) return;
      let value = clone(entry.value);
      if (key === "reminders" && value && typeof value === "object") delete value.id;
      out[key] = { value: value, updatedAt: at };
    });
    return out;
  }

  /* Takes a linked device's shared settings where they are newer than ours.
     Returns the keys that changed. Listeners hear them with from: "link". */
  function adopt(incoming, store) {
    const kept = store || browserStore();
    if (!kept || !incoming || typeof incoming !== "object") return [];
    const raw = migrate(kept);
    const changed = [];
    SHARED.forEach((key) => {
      const entry = incoming[key];
      if (!entry || typeof entry !== "object" || !("value" in entry)) return;
      const at = Number(entry.updatedAt) || 0;
      const mine = raw[key] && typeof raw[key] === "object" ? Number(raw[key].updatedAt) || 0 : 0;
      if (!at || at <= mine || at > Date.now() + 86400000) return;
      let value = known(key, entry.value);
      if (key === "reminders") {
        value = value && typeof value === "object" ? value : {};
        delete value.id;
        const local = raw[key] && raw[key].value;
        if (local && typeof local === "object" && local.id) value.id = local.id;
      }
      raw[key] = { value: clone(value), updatedAt: at };
      changed.push(key);
    });
    if (!changed.length) return changed;
    write(kept, raw);
    changed.forEach((key) => {
      listeners.forEach((fn) => {
        try { fn(key, get(key, kept), { from: "link" }); } catch (e) {}
      });
    });
    return changed;
  }

  if (browserStore()) migrate(browserStore());

  const api = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    SHARED: SHARED,
    get: get,
    set: set,
    subscribe: subscribe,
    migrate: migrate,
    entries: entries,
    erase: erase,
    sharedEntries: sharedEntries,
    adopt: adopt,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraSettings = api;
})(typeof window !== "undefined" ? window : null);
