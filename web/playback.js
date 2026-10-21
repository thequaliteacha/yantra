/* What can actually play on this device, and when a sit should give up on a song.
   Hosted mp3s play in the page. Spotify plays only where its in-page player is
   supported and the account is connected. Anything else is left off the shelf.
   A song that never starts is skipped, then left off the lists for the rest of the visit.
   The Sangha word sees only Vayu. Lumikara is for the Zazen word only.
   Hidden by access stays hidden. */
(function (root) {
  const LUMAKARA = "lumikara";
  const VAYU = "vayu";
  const STALL_MS = 5000;
  const PROGRESS_EPS = 0.25;

  function spotifySdkSupported(env) {
    const ua = String((env && env.userAgent) || "");
    const touch = Number(env && env.maxTouchPoints) || 0;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
    if (/Macintosh/.test(ua) && touch > 1) return false;
    return true;
  }

  /* Spotify can be picked only when this browser runs the in-page player and
     the account is connected. A phone or tablet does not run that player. */
  function spotifyUsable(session) {
    if (!session || session.failed || session.blocked || !session.connected || !session.sdk) return false;
    return true;
  }

  function trackKey(track) {
    if (!track) return "";
    if (track.key) return track.key;
    return (track.discId || "") + "#" + track.n;
  }

  function circleOpen(circle, level) {
    if (level === "sangha") return circle === VAYU;
    return circle !== LUMAKARA || level === "zazen";
  }

  function trackOffered(track, session) {
    if (!track) return false;
    if (!circleOpen(track.circle, session && session.level)) return false;
    const key = trackKey(track);
    if (key && session && session.failedKeys && session.failedKeys[key]) return false;
    if (track.hosted) return true;
    if (track.spotify && spotifyUsable(session)) return true;
    return false;
  }

  function filterTracks(tracks, session) {
    return (tracks || []).filter((track) => trackOffered(track, session));
  }

  function filterDiscs(discs, session) {
    const out = [];
    for (const disc of discs || []) {
      if (!disc || !circleOpen(disc.circle, session && session.level)) continue;
      const tracks = (disc.tracks || []).filter((track) => trackOffered(
        Object.assign({ circle: disc.circle }, track),
        session,
      ));
      if (!tracks.length) continue;
      out.push(Object.assign({}, disc, { tracks: tracks }));
    }
    return out;
  }

  /* A section stays up only while it still has an album that can play. */
  function visibleCircles(circles, discs) {
    const open = new Set((discs || []).map((disc) => disc.circle));
    return (circles || []).filter((circle) => circle && open.has(circle.id));
  }

  function createProgressWatch(limitMs) {
    const limit = Number(limitMs) > 0 ? Number(limitMs) : STALL_MS;
    let key = "";
    let position = 0;
    let at = 0;
    return {
      reset() {
        key = "";
        position = 0;
        at = 0;
      },
      sample(sampleKey, positionNow, playing, now) {
        const t = Number(now) || 0;
        const pos = Number(positionNow) || 0;
        const id = sampleKey || "";
        if (!playing || id !== key) {
          key = id;
          position = pos;
          at = t;
          return { stalled: false, moved: false };
        }
        if (pos > position + PROGRESS_EPS) {
          position = pos;
          at = t;
          return { stalled: false, moved: true };
        }
        return { stalled: t - at >= limit, moved: false };
      },
    };
  }

  /* error and a rejected play() fail immediately. stalled alone waits until the
     playhead has also been still for the watch window. */
  function classifyPlayback(event) {
    if (!event) return "";
    if (event.rejected) return "rejected";
    if (event.error) return "error";
    const limit = Number(event.limit) > 0 ? Number(event.limit) : STALL_MS;
    if ((event.stalled || event.quiet) && Number(event.sinceProgress) >= limit) return "stall";
    return "";
  }

  function presentState(player, watch) {
    const playing = !!(player && player.playing);
    const moved = !!(watch && watch.moved);
    const stalled = !!(watch && watch.stalled);
    const position = Number(player && player.position) || 0;
    const audible = playing && !stalled && (moved || position > 0.35);
    let status = "Paused";
    if (audible) status = "Playing";
    else if (playing && !stalled) status = "Starting";
    return { status: status, moving: audible && moved };
  }

  function calmLine(hasNext) {
    if (hasNext) return "This song didn't play. The next one is starting.";
    return "This song didn't play.";
  }

  function nextPlayable(items, index, canPlay) {
    const list = items || [];
    for (let i = Number(index) + 1; i < list.length; i += 1) {
      if (!canPlay || canPlay(list[i], i)) return i;
    }
    return -1;
  }

  const api = {
    LUMAKARA: LUMAKARA,
    STALL_MS: STALL_MS,
    spotifySdkSupported: spotifySdkSupported,
    spotifyUsable: spotifyUsable,
    circleOpen: circleOpen,
    trackOffered: trackOffered,
    filterTracks: filterTracks,
    filterDiscs: filterDiscs,
    visibleCircles: visibleCircles,
    createProgressWatch: createProgressWatch,
    classifyPlayback: classifyPlayback,
    presentState: presentState,
    calmLine: calmLine,
    nextPlayable: nextPlayable,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YantraPlayback = api;
})(typeof window !== "undefined" ? window : null);
