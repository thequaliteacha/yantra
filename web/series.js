/* Which playback report the yantra should draw.
   A volume change can blank the report, or shift its key, index, or status,
   for a moment. That is not a new song: the bloom, the chakra, and the ink stay. */
(function (root) {
  const HOLD_MS = 2000;
  const STABLE_MS = 1800;
  const ADVANCE_S = 3;
  const REWIND_S = 0.5;

  function indexOf(series) {
    const index = Number(series && series.index);
    return Number.isFinite(index) && index >= 0 ? index : 0;
  }

  function songId(series) {
    return (series.key || "") + ":" + indexOf(series);
  }

  function copySeries(series) {
    return {
      key: series.key || "",
      lengths: Array.isArray(series.lengths) ? series.lengths.slice() : [],
      index: indexOf(series),
      position: Number(series.position) || 0,
      length: Number(series.length) || 0,
      status: series.status || "",
      at: series.at,
      chakra: series.chakra || "",
    };
  }

  function commit(series, now, pausedAt) {
    return { held: series, seenAt: now, pendingKey: "", pendingAt: 0, pausedAt: pausedAt || 0 };
  }

  /* The next track of this album or form, opening at the start, is a real advance. */
  function isTrackAdvance(prev, next) {
    if (!prev || !next) return false;
    if ((prev.key || "") !== (next.key || "")) return false;
    if (indexOf(next) !== indexOf(prev) + 1) return false;
    const position = Number(next.position) || 0;
    return position >= 0 && position <= ADVANCE_S;
  }

  function holdSeries(state, incoming, now) {
    const nowMs = Number(now) || 0;
    if (!state || !state.held) {
      if (!incoming) return { state: null, series: null, songChanged: false };
      const held = copySeries(incoming);
      return { state: commit(held, nowMs), series: held, songChanged: true };
    }

    if (!incoming) {
      if (nowMs - state.seenAt < HOLD_MS) {
        return {
          state: {
            held: state.held,
            seenAt: state.seenAt,
            pendingKey: "",
            pendingAt: 0,
            pausedAt: state.pausedAt || 0,
          },
          series: state.held,
          songChanged: false,
        };
      }
      return { state: null, series: null, songChanged: false };
    }

    if (songId(incoming) === songId(state.held)) {
      const held = copySeries(incoming);
      held.chakra = state.held.chakra || held.chakra;
      if (held.position + REWIND_S < (Number(state.held.position) || 0)) {
        held.position = state.held.position;
        held.at = state.held.at;
      }
      let pausedAt = 0;
      if (state.held.status === "Playing" && incoming.status !== "Playing") {
        pausedAt = state.pausedAt || nowMs;
        if (nowMs - pausedAt < HOLD_MS) held.status = "Playing";
        else pausedAt = 0;
      }
      return { state: commit(held, nowMs, pausedAt), series: held, songChanged: false };
    }

    if (isTrackAdvance(state.held, incoming)) {
      const held = copySeries(incoming);
      return { state: commit(held, nowMs), series: held, songChanged: true };
    }

    const nextId = songId(incoming);
    const pendingAt = state.pendingKey === nextId ? state.pendingAt : nowMs;
    if (nowMs - pendingAt >= STABLE_MS) {
      const held = copySeries(incoming);
      return { state: commit(held, nowMs), series: held, songChanged: true };
    }
    return {
      state: { held: state.held, seenAt: state.seenAt, pendingKey: nextId, pendingAt: pendingAt, pausedAt: 0 },
      series: state.held,
      songChanged: false,
    };
  }

  /* The ink of one song only moves forward. A new song passes a new key. */
  function forwardPortion(state, key, portion) {
    const next = Math.max(0, Math.min(1, portion || 0));
    if (state.key !== key) {
      state.key = key;
      state.portion = next;
    } else if (next > state.portion) {
      state.portion = next;
    }
    return state.portion;
  }

  const api = {
    HOLD_MS: HOLD_MS,
    STABLE_MS: STABLE_MS,
    ADVANCE_S: ADVANCE_S,
    holdSeries: holdSeries,
    forwardPortion: forwardPortion,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraSeries = api;
})(typeof window !== "undefined" ? window : null);
