/* A name and a greeting. Both stay in this browser. */
(function (root) {
  const KEY = "yantra.profile.v1";
  const GREETINGS = ["none", "hello", "time"];

  function storage() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function cleanName(value) {
    return String(value || "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const greeting = GREETINGS.indexOf(source.greeting) >= 0 ? source.greeting : "none";
    return { name: cleanName(source.name), greeting: greeting };
  }

  function empty() {
    return { name: "", greeting: "none" };
  }

  function settingsApi() {
    if (root && root.YantraSettings) return root.YantraSettings;
    if (typeof require === "function") {
      try { return require("./settings.js"); } catch (e) { return null; }
    }
    return null;
  }

  function load() {
    const settings = settingsApi();
    if (settings) return normalize({ name: settings.get("profile.name"), greeting: settings.get("profile.greeting") });
    const kept = storage();
    if (!kept) return empty();
    try { return normalize(JSON.parse(kept.getItem(KEY) || "null")); } catch (e) { return empty(); }
  }

  function save(profile) {
    const clean = normalize(profile);
    const settings = settingsApi();
    if (settings) {
      settings.set("profile.name", clean.name);
      settings.set("profile.greeting", clean.greeting);
      return clean;
    }
    const kept = storage();
    if (!kept) return clean;
    try { kept.setItem(KEY, JSON.stringify(clean)); } catch (e) {}
    return clean;
  }

  /* What the home screen and the completion screen may say. */
  function line(profile, now) {
    const clean = normalize(profile);
    if (clean.greeting === "none") return "";
    const date = now instanceof Date ? now : new Date();
    const hour = date.getHours();
    let hello = "Hello";
    if (clean.greeting === "time") {
      if (hour < 12) hello = "Good morning";
      else if (hour < 17) hello = "Good afternoon";
      else hello = "Good evening";
    }
    return clean.name ? hello + ", " + clean.name + "." : hello + ".";
  }

  function listYantraKeys(store) {
    const keys = [];
    if (!store || typeof store.length !== "number" || typeof store.key !== "function") return keys;
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && String(key).indexOf("yantra.") === 0) keys.push(key);
    }
    return keys;
  }

  function clearYantra(store) {
    listYantraKeys(store).forEach((key) => store.removeItem(key));
  }

  const api = {
    KEY: KEY,
    GREETINGS: GREETINGS,
    empty: empty,
    normalize: normalize,
    cleanName: cleanName,
    load: load,
    save: save,
    line: line,
    listYantraKeys: listYantraKeys,
    clearYantra: clearYantra,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraProfile = api;
})(typeof window !== "undefined" ? window : null);
