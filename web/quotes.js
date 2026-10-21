/* Completion lines. web/quotes.json holds the verbatim quotes and the theme tags.
   A quote is tagged only when the line itself says the theme. Album and track
   tags name what that sit was. The completion screen prefers a matching line,
   then falls back to any of the lines. Nothing here is paraphrased. */
(function (root) {
  const THEME = /^[a-z][a-z0-9-]{0,30}$/;
  const LAST = "yantra.lastQuote";
  const MATCH = 3;
  const AGAIN = 0.35;

  function allowedOf(file) {
    const names = file && Array.isArray(file.themes) ? file.themes : [];
    return new Set(names.filter((name) => THEME.test(String(name))));
  }

  function themeList(raw, allowed) {
    const out = [];
    (Array.isArray(raw) ? raw : []).forEach((name) => {
      const theme = String(name || "");
      if (!THEME.test(theme) || (allowed && !allowed.has(theme)) || out.includes(theme)) return;
      out.push(theme);
    });
    return out.slice(0, 12);
  }

  function slug(talk, index) {
    const base = String(talk || "quote").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "quote";
    return base + "-" + index;
  }

  function clean(value, max) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  /* The lines in quotes.json, copied exactly. */
  function pool(file) {
    const allowed = allowedOf(file);
    const rows = Array.isArray(file) ? file : (file && file.quotes) || [];
    const quotes = [];
    const texts = new Set();
    rows.forEach((raw, index) => {
      if (!raw || typeof raw.text !== "string") return;
      const text = raw.text.trim();
      if (!text || text.length > 4000 || texts.has(text)) return;
      const talk = clean(raw.talk, 180);
      texts.add(text);
      quotes.push({
        id: slug(talk, index + 1),
        text,
        talk,
        by: clean(raw.by, 80),
        href: typeof raw.href === "string" ? raw.href.trim().slice(0, 300) : "",
        themes: themeList(raw.themes, allowed),
      });
    });
    return quotes;
  }

  /* Themes named by the albums and tracks in this sit. Unknown names are ignored. */
  function themesFor(tracks, file) {
    const allowed = allowedOf(file);
    const albums = (file && file.albums) || {};
    const trackTags = (file && file.tracks) || {};
    const found = [];
    const add = (name) => {
      const theme = String(name || "");
      if (!allowed.has(theme) || found.includes(theme)) return;
      found.push(theme);
    };
    (Array.isArray(tracks) ? tracks : []).forEach((item) => {
      if (!item || !item.discId) return;
      (albums[item.discId] || []).forEach(add);
      const per = trackTags[item.discId] || {};
      (per[String(item.n)] || []).forEach(add);
    });
    return found;
  }

  function sitThemesOf(options) {
    if (!options) return [];
    if (Array.isArray(options.themes)) return themeList(options.themes, allowedOf({ themes: options.themes }));
    const file = options.file || { themes: options.themeNames, albums: options.albums, tracks: options.trackTags };
    return themesFor(options.tracks, file);
  }

  /* A matching line is three times a line that does not match, and only when
     something matches. The line shown last time is pulled down so it is not sticky.
     No matching theme leaves every line equal. */
  function select(quotes, options, random) {
    const list = Array.isArray(quotes) ? quotes.filter((quote) => quote && quote.text) : [];
    if (!list.length) return null;
    const rng = typeof random === "function" ? random : Math.random;
    const sitThemes = sitThemesOf(options);
    const anyMatch = sitThemes.length > 0 && list.some((quote) => (quote.themes || []).some((theme) => sitThemes.includes(theme)));
    const lastId = options && options.lastId ? String(options.lastId) : "";
    const weights = list.map((quote) => {
      const matches = anyMatch && (quote.themes || []).some((theme) => sitThemes.includes(theme));
      let weight = matches ? MATCH : 1;
      if (lastId && quote.id === lastId) weight *= AGAIN;
      return weight;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!(total > 0)) return null;
    let pick = Number(rng());
    if (!Number.isFinite(pick)) pick = 0;
    pick *= total;
    for (let i = 0; i < list.length; i++) {
      pick -= weights[i];
      if (pick < 0) return list[i];
    }
    return list[list.length - 1];
  }

  function readLast() {
    try { return sessionStorage.getItem(LAST) || ""; } catch (e) { return ""; }
  }

  function remember(id) {
    try { sessionStorage.setItem(LAST, id); } catch (e) {}
  }

  /* file is quotes.json. sit is the album and track that just played.
     Returns null when there is nothing to show. */
  function choose(file, sit, random) {
    const quotes = pool(file);
    if (!quotes.length) return null;
    const chosen = select(quotes, { tracks: Array.isArray(sit) ? sit : [], file, lastId: readLast() }, random);
    if (!chosen) return null;
    remember(chosen.id);
    return chosen;
  }

  const api = { pool, themesFor, select, choose, LAST };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraQuotes = api;
})(typeof window !== "undefined" ? window : null);
