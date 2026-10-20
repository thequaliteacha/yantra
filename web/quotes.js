/* Completion lines. web/quotes.json holds the verbatim quotes and the theme tags.
   talks.json can add a quote once it is real data: kind "quote", example not set,
   and the text copied exactly. A from id points at the talk or meditation it came from. */
(function (root) {
  const THEME = /^[a-z][a-z0-9-]{0,30}$/;
  const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
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

  /* The eight lines, then any real quote row in the talks list that is not a duplicate. */
  function poolFrom(file, talks) {
    const allowed = allowedOf(file);
    const quotes = [];
    const texts = new Set();
    const ids = new Set();
    (Array.isArray(file && file.quotes) ? file.quotes : []).forEach((raw, index) => {
      if (!raw || typeof raw.text !== "string") return;
      const text = raw.text.trim();
      if (!text || text.length > 4000 || texts.has(text)) return;
      const talk = clean(raw.talk, 180);
      const id = slug(talk, index + 1);
      if (ids.has(id)) return;
      texts.add(text);
      ids.add(id);
      quotes.push({
        id,
        text,
        talk,
        source: typeof raw.source === "string" ? raw.source.trim().slice(0, 300) : "",
        themes: themeList(raw.themes, allowed),
        libraryId: "",
        fromTitle: "",
      });
    });

    const items = Array.isArray(talks) ? talks : [];
    items.forEach((row) => {
      if (!row || row.kind !== "quote" || row.example === true) return;
      if (typeof row.text !== "string") return;
      const text = row.text.trim();
      const id = String(row.id || "");
      if (!text || text.length > 4000 || texts.has(text) || !ID.test(id) || ids.has(id)) return;
      const from = String(row.from || "");
      const target = from && from !== id ? items.find((item) => item && item.id === from) : null;
      const linked = target && target.kind !== "quote" && target.example !== true && clean(target.title, 180);
      texts.add(text);
      ids.add(id);
      quotes.push({
        id,
        text,
        talk: clean(row.title, 180),
        source: typeof row.source === "string" ? row.source.trim().slice(0, 300) : "",
        themes: themeList(row.themes, allowed),
        libraryId: linked ? target.id : "",
        fromTitle: linked ? clean(target.title, 180) : "",
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

  async function choose(sit) {
    let file = null;
    try {
      const response = await fetch("quotes.json", { cache: "no-store" });
      if (response.ok) file = await response.json();
    } catch (e) {}
    if (!file || !Array.isArray(file.quotes)) return null;
    let talks = [];
    try {
      const response = await fetch("talks.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) talks = data;
      }
    } catch (e) {}
    const quotes = poolFrom(file, talks);
    let lastId = "";
    try { lastId = sessionStorage.getItem(LAST) || ""; } catch (e) {}
    const chosen = select(quotes, { tracks: Array.isArray(sit) ? sit : [], file, lastId });
    if (!chosen) return null;
    try { sessionStorage.setItem(LAST, chosen.id); } catch (e) {}
    return chosen;
  }

  function applyQuote(quote) {
    const node = document.getElementById("done-quote");
    const credit = document.getElementById("done-credit");
    const link = document.getElementById("done-talk");
    const from = document.getElementById("done-from");
    const words = document.getElementById("done-words");
    if (!node || !quote || typeof quote.text !== "string" || !quote.text) return false;
    node.textContent = "\u201c" + quote.text + "\u201d";
    if (quote.libraryId && quote.fromTitle && from) {
      if (credit) credit.hidden = true;
      from.hidden = false;
      from.textContent = "From: " + quote.fromTitle;
      from.dataset.libraryId = quote.libraryId;
    } else {
      if (from) {
        from.hidden = true;
        delete from.dataset.libraryId;
      }
      if (credit) credit.hidden = false;
      if (link) {
        link.textContent = quote.talk || "";
        link.href = quote.source || "";
      }
    }
    if (words) words.hidden = false;
    return true;
  }

  function bindFrom() {
    const from = document.getElementById("done-from");
    if (!from || from.dataset.bound) return;
    from.dataset.bound = "1";
    from.addEventListener("click", () => {
      const id = from.dataset.libraryId;
      if (id && typeof root.yantraOpenTalk === "function") root.yantraOpenTalk(id);
    });
  }

  const api = { poolFrom, themesFor, select, choose, applyQuote };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.YantraQuotes = api;
    if (typeof document !== "undefined") {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindFrom);
      else bindFrom();
    }
  }
})(typeof window !== "undefined" ? window : null);
