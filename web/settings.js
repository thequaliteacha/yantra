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
  };
  const LEGACY = ["yantra.profile.v1", "yantra.reminders.v1", "yantra.glow"];
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
    if (key === "glow.level") {
      if (value === null || value === undefined || value === "") return null;
      const level = Number(value);
      if (!Number.isFinite(level)) return null;
      return Math.max(0, Math.min(200, Math.round(level)));
    }
    if (key === "account.preferredMethod") {
      const method = String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
      return method || "telegram";
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
    const wrapped = (changed, value) => {
      if (key === "*" || key === changed) fn(changed, value);
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

  if (browserStore()) migrate(browserStore());

  const api = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    get: get,
    set: set,
    subscribe: subscribe,
    migrate: migrate,
    entries: entries,
    erase: erase,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraSettings = api;
})(typeof window !== "undefined" ? window : null);
