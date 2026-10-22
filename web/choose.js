/* Which album a sit starts on when the app chooses, or when a remembered album
   cannot play on this device. Only songs that can play are eligible. A remembered
   album that cannot play falls back without asking: the same circle when one
   fits, otherwise an album the morning or evening set already uses, otherwise
   any album that can play. Mix It Up keeps a song or replaces it with another
   playable song of the same chakra. Nothing playable means no sit. */
(function (root) {
  const CHAKRAS = ["naval", "heart", "eye"];
  const COUNTS = [1, 3, 6, 12];

  function emptyLine() {
    return "Nothing is ready to play on this device right now.";
  }

  function trackChakra(disc, number) {
    const count = disc.tracks.length;
    if (number <= Math.floor(count / 3)) return "naval";
    if (number <= Math.floor((2 * count) / 3)) return "heart";
    return "eye";
  }

  function rngOf(rng) {
    if (typeof rng === "function") return rng;
    const n = Number(rng);
    if (Number.isFinite(n)) return () => ((n % 1) + 1) % 1;
    return Math.random;
  }

  function sample(pool, count, rng) {
    const copy = (pool || []).slice();
    const random = rngOf(rng);
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy.slice(0, count);
  }

  function albumFits(disc, count, canPlay) {
    if (!disc || !disc.tracks || !COUNTS.includes(count)) return false;
    const sizes = { naval: 0, heart: 0, eye: 0 };
    for (const track of disc.tracks) {
      if (!canPlay(disc, track)) continue;
      sizes[trackChakra(disc, track.n)] += 1;
    }
    if (count === 1) return sizes.heart > 0;
    const per = count / 3;
    return CHAKRAS.every((chakra) => sizes[chakra] >= per);
  }

  function narrow(pool, pred) {
    const next = pool.filter(pred);
    return next.length ? next : null;
  }

  /* preferredId wins when that album can play this sit. Otherwise the same
     circle, then albums the sit's theme names, then that theme's circle,
     then any album that fits. avoidId rotates a free choice away from the
     album the previous sit used. */
  function chooseAlbum(opts) {
    const canPlay = opts.canPlay || (() => false);
    const fitting = (opts.discs || []).filter((disc) => albumFits(disc, opts.count, canPlay));
    if (!fitting.length) return null;
    if (opts.preferredId) {
      const preferred = fitting.find((disc) => disc.id === opts.preferredId);
      if (preferred) return preferred;
    }
    const catalog = opts.catalog || opts.discs || [];
    const remembered = catalog.find((disc) => disc && disc.id === opts.preferredId);
    let pool = fitting;
    if (remembered && remembered.circle) {
      const same = narrow(pool, (disc) => disc.circle === remembered.circle);
      if (same) pool = same;
    }
    const themeIds = opts.themeIds || [];
    if (themeIds.length) {
      const named = narrow(pool, (disc) => themeIds.indexOf(disc.id) >= 0);
      if (named) pool = named;
      else if (!remembered || pool === fitting) {
        const circles = {};
        catalog.forEach((disc) => {
          if (disc && themeIds.indexOf(disc.id) >= 0 && disc.circle) circles[disc.circle] = true;
        });
        const themed = narrow(fitting, (disc) => circles[disc.circle]);
        if (themed) pool = themed;
      }
    }
    if (opts.avoidId && pool.length > 1) {
      const narrower = narrow(pool, (disc) => disc.id !== opts.avoidId);
      if (narrower) pool = narrower;
    }
    const random = rngOf(opts.rng);
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    return pool[index];
  }

  function sitTracks(disc, count, canPlay, rng) {
    if (!albumFits(disc, count, canPlay)) return null;
    const order = count === 1 ? ["heart"] : CHAKRAS;
    const per = count === 1 ? 1 : count / 3;
    const items = [];
    for (const chakra of order) {
      const songs = disc.tracks.filter((track) => trackChakra(disc, track.n) === chakra && canPlay(disc, track));
      const picked = sample(songs, per, rng).sort((a, b) => a.n - b.n);
      if (picked.length < per) return null;
      for (const track of picked) items.push({ discId: disc.id, n: track.n, chakra });
    }
    return items.length === count ? items : null;
  }

  /* keep: the song itself can play here from the sangha's copy.
     playable: it can play some other way (Spotify, where that player runs).
     substitute: another playable song of the same chakra. */
  function fillMix(items, opts) {
    const keep = (opts && opts.keep) || (() => false);
    const playable = (opts && opts.playable) || (() => false);
    const substitute = (opts && opts.substitute) || (() => null);
    const used = new Set();
    const out = [];
    for (const item of items || []) {
      if (!item) return null;
      const key = item.discId + "#" + item.n;
      if (keep(item) && !used.has(key)) {
        used.add(key);
        out.push({ discId: item.discId, n: item.n, chakra: item.chakra });
        continue;
      }
      const next = substitute(item.chakra, used);
      const nextKey = next && next.discId ? next.discId + "#" + next.n : "";
      if (nextKey && !used.has(nextKey)) {
        used.add(nextKey);
        out.push({ discId: next.discId, n: next.n, chakra: item.chakra });
        continue;
      }
      if (playable(item) && !used.has(key)) {
        used.add(key);
        out.push({ discId: item.discId, n: item.n, chakra: item.chakra });
        continue;
      }
      return null;
    }
    return out.length ? out : null;
  }

  /* The Spotify panel is for a listener who asked for a particular album and
     whose device was expected to play it. A phone, a free choice, and a quiet
     fallback do not announce. */
  function announceSwap(info) {
    return !!(info && info.explicit && info.swapped && info.spotifyExpected);
  }

  function planQuickSit(opts) {
    const count = Number(opts && opts.count);
    const theme = opts && opts.theme === "evening" ? "evening" : "morning";
    if (!COUNTS.includes(count)) return { ok: false, line: emptyLine(), theme, via: "" };
    const level = (opts && opts.level) || "";
    const open = (disc) => !opts.circleOpen || opts.circleOpen(disc.circle, level);
    const catalog = ((opts && opts.discs) || []).filter((disc) => disc && open(disc));
    const canPlay = (opts && opts.canPlay) || (() => false);
    const mix = !!(opts && opts.mix);
    if (mix) {
      const filled = fillMix(opts.mixItems || [], {
        keep: opts.keep,
        playable: opts.playable,
        substitute: opts.substitute,
      });
      const playable = opts.playable || (() => false);
      if (filled && filled.length === count && filled.every((item) => playable(item) || (opts.keep && opts.keep(item)))) {
        return { ok: true, items: filled, via: "mix", albumId: "", requestedId: "", theme, announce: false };
      }
    }
    const preferredId = mix ? "" : String((opts && opts.albumId) || "");
    const disc = chooseAlbum({
      discs: catalog,
      catalog,
      count,
      preferredId,
      themeIds: (opts && opts.themeIds) || [],
      avoidId: preferredId ? "" : ((opts && opts.lastId) || ""),
      canPlay,
      rng: opts && opts.rng,
    });
    if (!disc) return { ok: false, line: emptyLine(), theme, via: "" };
    const items = sitTracks(disc, count, canPlay, opts && opts.rng);
    const playableItem = opts.playable || ((item) => canPlay(disc, { n: item.n }));
    if (!items || items.some((item) => !playableItem(item) && !(opts.keep && opts.keep(item)))) {
      return { ok: false, line: emptyLine(), theme, via: "" };
    }
    let via = "default";
    if (preferredId && disc.id === preferredId) via = "album";
    else if (preferredId || mix) via = "fallback";
    return {
      ok: true,
      items,
      via,
      albumId: disc.id,
      requestedId: preferredId,
      theme,
      announce: false,
    };
  }

  const api = {
    emptyLine: emptyLine,
    trackChakra: trackChakra,
    albumFits: albumFits,
    chooseAlbum: chooseAlbum,
    sitTracks: sitTracks,
    fillMix: fillMix,
    announceSwap: announceSwap,
    planQuickSit: planQuickSit,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraChoose = api;
})(typeof window !== "undefined" ? window : null);
