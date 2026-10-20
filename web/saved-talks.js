/* Dharma talks saved on this device. The key is the talks.json id
   (the same id the r2Key file name uses). Nothing is sent. */
(function (root) {
  const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
  const KEY = /^talks\/(?:[a-z0-9][a-z0-9-]{0,40}\/)*([a-z0-9][a-z0-9-]{0,80})\.([a-z0-9]{1,8})$/;

  function settings() {
    return root && root.YantraSettings ? root.YantraSettings : null;
  }

  function saved() {
    const api = settings();
    const list = api ? api.get("talks.saved") : [];
    return Array.isArray(list) ? list.filter((id) => ID.test(id)) : [];
  }

  function isSaved(id) {
    return ID.test(String(id || "")) && saved().indexOf(id) >= 0;
  }

  function toggle(id) {
    const clean = String(id || "");
    if (!ID.test(clean)) return false;
    const api = settings();
    if (!api) return isSaved(clean);
    const list = saved();
    const next = list.indexOf(clean) >= 0 ? list.filter((item) => item !== clean) : list.concat([clean]);
    api.set("talks.saved", next);
    return next.indexOf(clean) >= 0;
  }

  function rowsOf(list) {
    if (Array.isArray(list)) return list;
    if (list && Array.isArray(list.talks)) return list.talks;
    return [];
  }

  /* A same-origin /talks/ address, or null. Quotes, examples, and any
     http or off-site address stay out of the player. */
  function playable(row) {
    if (!row || typeof row !== "object") return null;
    if (row.kind === "quote" || row.example === true) return null;
    const id = String(row.id || "");
    const key = String(row.r2Key || "");
    const match = KEY.exec(key);
    if (!ID.test(id) || !match || match[1] !== id) return null;
    if (/^https?:/i.test(key) || key.indexOf("..") >= 0 || key.indexOf("\\") >= 0) return null;
    const title = String(row.title || "").replace(/\s+/g, " ").trim().slice(0, 180);
    return { id: id, title: title || id, r2Key: key, url: "/" + key };
  }

  const api = { ID: ID, KEY: KEY, saved: saved, isSaved: isSaved, toggle: toggle, rowsOf: rowsOf, playable: playable };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraSavedTalks = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
