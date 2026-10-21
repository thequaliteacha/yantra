/* Web edition of Yantra.
 *
 * The desktop page talks to yantra.py. Here the same requests are answered in
 * the browser: the shelf comes from ../discs.json, saved forms live in this
 * browser, albums open in Spotify or Apple Music, and the yantra follows a
 * hosted recording (or breathes slowly when the music cannot be read).
 * The page never asks for the microphone.
 */
(() => {
  // Tells the page it runs as the web edition, so it opens on the morning/evening home.
  window.YANTRA_WEB = true;
  const realFetch = window.fetch.bind(window);
  const CHAKRAS = ["naval", "heart", "eye"];
  const CHAKRA_NAME = { naval: "Navel", heart: "Heart chakra", eye: "Third eye chakra" };
  const FORM_SIZES = [3, 6, 9, 12];
  const DISCS = {};
  let collection = null;
  let links = {};
  let sets = null;
  let recordings = {};
  const config = { spotifyClientId: "", appleDeveloperToken: "", audioBase: "audio/" };

  const ready = Promise.all([
    realFetch("../discs.json").then((r) => r.json()),
    realFetch("tracks.json").then((r) => r.json()).catch(() => ({})),
    realFetch("config.json", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    realFetch("sets.json").then((r) => r.json()).catch(() => null),
    realFetch("audio.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    realFetch("/access", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]).then(async ([discs, songs, settings, sessionSets, files, access]) => {
    const level = (access && access.level) || "";
    window.YANTRA_LEVEL = level;
    window.yantraQuotes = [];
    if (level === "sangha") {
      discs.circles = (discs.circles || []).filter((circle) => circle.id === "vayu");
      discs.discs = discs.discs.filter((disc) => disc.circle === "vayu");
    }
    // Lumikara is for the Zazen word only.
    discs.circles = (discs.circles || []).filter((circle) => Playback.circleOpen(circle.id, level));
    discs.discs = discs.discs.filter((disc) => Playback.circleOpen(disc.circle, level));
    sets = sessionSets;
    recordings = files || {};
    Object.assign(config, settings || {});
    collection = discs;
    links = songs || {};
    for (const disc of discs.discs) DISCS[disc.id] = disc;
    if (level === "zazen") {
      const response = await realFetch("quotes.json", { cache: "no-store" }).catch(() => null);
      if (response && response.ok) {
        const rows = await response.json().catch(() => []);
        window.yantraQuotes = Array.isArray(rows) ? rows : [];
      }
      // Rama talks, for the Zazen word only (the Worker refuses talks.json to the Sangha word).
      const talks = await realFetch("talks.json", { cache: "no-store" }).catch(() => null);
      if (talks && talks.ok) window.yantraTalks = await talks.json().catch(() => null);
    }
    if (typeof window.paintTalks === "function") window.paintTalks();
  });

  /* ---- the shelf ---- */

  // Apple Music is off for now, as on the desktop. The Apple links stay in the data.
  const APPLE_MUSIC = false;

  function appleId(disc) {
    if (!APPLE_MUSIC) return "";
    const source = String(disc.source || "");
    if (!source.startsWith("apple:")) return "";
    const id = source.slice(6).trim();
    return /^\d+$/.test(id) ? id : "";
  }

  function chakraOf(disc, number) {
    const count = disc.tracks.length;
    if (number <= Math.floor(count / 3)) return "naval";
    if (number <= Math.floor((2 * count) / 3)) return "heart";
    return "eye";
  }

  /* The sangha's own recordings (web/audio.json) play right in the page, no account needed. */
  function recordingOf(discId, number) {
    const path = (recordings[discId] || {})[String(number)];
    return path ? config.audioBase + path : "";
  }
  const onRecordings = (disc) => disc.tracks.length > 0 && disc.tracks.every((track) => recordingOf(disc.id, track.n));
  const Playback = window.YantraPlayback;
  const failedKeys = {};
  function navEnv() {
    return {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      maxTouchPoints: typeof navigator !== "undefined" ? (navigator.maxTouchPoints || 0) : 0,
    };
  }

  /* A disc is on the shelf when at least one of its songs can play here.
     Lumikara is for the Zazen word only. */
  const closedDisc = (disc) => !disc || !Playback.circleOpen(disc.circle, window.YANTRA_LEVEL);
  function playable(disc) {
    if (closedDisc(disc)) return false;
    return disc.tracks.some((track) => itemPlayable({ discId: disc.id, n: track.n }));
  }

  function trackRef(discId, number) {
    const disc = DISCS[discId];
    const track = disc.tracks.find((item) => item.n === number);
    const onSpotify = !!disc.spotifyAlbum;
    const onApple = !!appleId(disc);
    return {
      discId, n: number, title: track.title, disc: disc.title, artist: disc.artist,
      chakra: chakraOf(disc, number), onSpotify, onApple, installed: false,
      playable: itemPlayable({ discId, n: number }),
    };
  }

  function collectionPayload() {
    const payload = Object.assign({}, collection);
    payload.circles = (collection.circles || []).filter((circle) => Playback.circleOpen(circle.id, window.YANTRA_LEVEL));
    payload.discs = collection.discs.filter(playable).map((disc) => Object.assign({}, disc, {
      tracks: disc.tracks.filter((track) => itemPlayable({ discId: disc.id, n: track.n })).map((track) => Object.assign({}, track, { chakra: chakraOf(disc, track.n), installed: false })),
      onSpotify: !!disc.spotifyAlbum,
      onApple: !!appleId(disc),
      onRecordings: disc.tracks.filter((track) => itemPlayable({ discId: disc.id, n: track.n })).every((track) => recordingOf(disc.id, track.n)),
      installed: 0,
      installDir: "",
    })).filter((disc) => disc.tracks.length > 0);
    payload.installRoot = "";
    payload.chakras = [
      { id: "naval", name: "Navel", third: "first" },
      { id: "heart", name: "Heart chakra", third: "middle" },
      { id: "eye", name: "Third eye chakra", third: "last" },
    ];
    payload.forms = FORM_SIZES.slice();
    return payload;
  }

  /* ---- forms: three equal thirds, naval, heart, third eye ---- */

  function shelfSong(item) {
    if (!item || typeof item !== "object") return null;
    const disc = DISCS[item.discId];
    const number = item.n;
    if (!disc || !disc.tracks.some((track) => track.n === number)) return null;
    return [disc, number];
  }

  function orderedDraft(tracks) {
    const buckets = { naval: [], heart: [], eye: [] };
    const seen = new Set();
    for (const item of tracks || []) {
      const found = shelfSong(item);
      if (!found) continue;
      const [disc, number] = found;
      const key = disc.id + "#" + number;
      if (seen.has(key)) continue;
      seen.add(key);
      buckets[chakraOf(disc, number)].push({ discId: disc.id, n: number });
    }
    return CHAKRAS.flatMap((name) => buckets[name]);
  }

  const refs = (tracks) => orderedDraft(tracks).map((item) => trackRef(item.discId, item.n));

  function chakraPool(chakra) {
    const pool = [];
    for (const disc of collection.discs) {
      if (closedDisc(disc)) continue;
      for (const track of disc.tracks) {
        if (chakraOf(disc, track.n) !== chakra) continue;
        if (!itemPlayable({ discId: disc.id, n: track.n })) continue;
        pool.push([disc.id, track.n]);
      }
    }
    return pool;
  }

  /* Songs the sangha has recorded, so they play without Spotify. */
  function recordedPool(chakra) {
    return chakraPool(chakra).filter(([discId, n]) => recordingOf(discId, n));
  }

  function sample(pool, count) {
    const copy = pool.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  }

  function formTracks(size) {
    if (!FORM_SIZES.includes(size)) return null;
    const per = size / 3;
    const chosen = [];
    for (const chakra of CHAKRAS) {
      const recorded = recordedPool(chakra);
      const pool = recorded.length >= per ? recorded : chakraPool(chakra);
      if (pool.length < per) return null;
      chosen.push(...sample(pool, per));
    }
    return chosen.map(([discId, n]) => trackRef(discId, n));
  }

  function takeSong(tracks, discId, number) {
    let ordered = orderedDraft(tracks);
    const disc = DISCS[discId];
    if (!disc || !disc.tracks.some((track) => track.n === number)) return [null, "That song is not on the shelf."];
    const isIn = ordered.some((item) => item.discId === disc.id && item.n === number);
    if (!isIn && !itemPlayable({ discId: disc.id, n: number })) return [null, "That song can't be played here."];
    if (isIn) {
      return [ordered.filter((item) => !(item.discId === disc.id && item.n === number)), null];
    }
    const chakra = chakraOf(disc, number);
    const count = ordered.filter((item) => chakraOf(DISCS[item.discId], item.n) === chakra).length;
    if (count >= 4) return [null, CHAKRA_NAME[chakra] + " already has four songs."];
    ordered.push({ discId: disc.id, n: number });
    return [orderedDraft(ordered), null];
  }

  function swapSong(tracks, index) {
    const ordered = orderedDraft(tracks);
    if (index < 0 || index >= ordered.length) return [null, "That place is not in the form."];
    const item = ordered[index];
    const chakra = chakraOf(DISCS[item.discId], item.n);
    const used = new Set(ordered.map((row) => row.discId + "#" + row.n));
    let pool = chakraPool(chakra).filter(([d, n]) => !used.has(d + "#" + n));
    if (!pool.length) pool = chakraPool(chakra).filter(([d, n]) => !(d === item.discId && n === item.n));
    if (pool.length) {
      const [discId, n] = pool[Math.floor(Math.random() * pool.length)];
      ordered[index] = { discId, n };
    }
    return [orderedDraft(ordered), null];
  }

  function moveSong(tracks, index, direction) {
    const ordered = orderedDraft(tracks);
    if (![-1, 1].includes(direction) || index < 0 || index >= ordered.length) return ordered;
    const other = index + direction;
    if (other < 0 || other >= ordered.length) return ordered;
    const here = chakraOf(DISCS[ordered[index].discId], ordered[index].n);
    const there = chakraOf(DISCS[ordered[other].discId], ordered[other].n);
    if (here !== there) return ordered;
    [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
    return ordered;
  }

  function playlistError(tracks) {
    if (!Array.isArray(tracks)) return "A form is 3, 6, 9, or 12 songs.";
    const seen = new Set();
    const counts = { naval: 0, heart: 0, eye: 0 };
    for (const item of tracks) {
      const found = shelfSong(item);
      if (!found) return "A song in this form is not from the shelf.";
      const [disc, number] = found;
      const key = disc.id + "#" + number;
      if (seen.has(key)) return "Each song is used once in a form.";
      seen.add(key);
      counts[chakraOf(disc, number)] += 1;
    }
    const values = CHAKRAS.map((name) => counts[name]);
    if (values.some((value) => value > 4)) return "Each chakra holds at most four songs.";
    if (new Set(values).size !== 1) return "Navel, heart, and third eye keep the same number of songs.";
    const total = values.reduce((a, b) => a + b, 0);
    if (!FORM_SIZES.includes(total)) return "A form is 3, 6, 9, or 12 songs.";
    const per = total / 3;
    const ordered = orderedDraft(tracks);
    for (let index = 0; index < ordered.length; index += 1) {
      const [disc, number] = shelfSong(ordered[index]);
      const expected = CHAKRAS[Math.floor(index / per)];
      if (chakraOf(disc, number) !== expected) {
        return CHAKRA_NAME[expected] + " keeps the " + ["first", "middle", "last"][Math.floor(index / per)] + " third of the form.";
      }
    }
    return null;
  }

  /* Saved forms belong to one listener: they are kept in this browser under the
     connected Spotify account, so each person sees only their own. Nothing is shared. */
  function formsKey() {
    return "yantra.forms." + ((spotify.token && spotify.token.user) || "guest");
  }
  function readForms() {
    try {
      const kept = JSON.parse(localStorage.getItem(formsKey()) || "null");
      if (Array.isArray(kept)) return kept;
    } catch (e) {}
    return [];
  }
  function writeForms(items) {
    try { localStorage.setItem(formsKey(), JSON.stringify(items)); } catch (e) {}
  }
  function publicForms() {
    return readForms()
      .filter((item) => !playlistError(item.tracks || []))
      .map((item) => ({ id: item.id, name: item.name || "Untitled", tracks: item.tracks.map((t) => trackRef(t.discId, t.n)) }));
  }

  function editForms(payload) {
    const op = payload.op;
    if (op === "form") {
      const tracks = formTracks(Number(payload.size) || 0);
      return tracks ? [{ ok: true, tracks }] : [{ ok: false, error: "Choose 3, 6, 9, or 12 songs." }, 400];
    }
    if (op === "take") {
      const [tracks, error] = takeSong(payload.tracks || [], payload.discId, Number(payload.n) || 0);
      return error ? [{ ok: false, error }, 400] : [{ ok: true, tracks: refs(tracks) }];
    }
    if (op === "swap") {
      const [tracks, error] = swapSong(payload.tracks || [], Number.isInteger(payload.index) ? payload.index : -1);
      return error ? [{ ok: false, error }, 400] : [{ ok: true, tracks: refs(tracks) }];
    }
    if (op === "move") {
      return [{ ok: true, tracks: refs(moveSong(payload.tracks || [], Number(payload.index), Number(payload.direction))) }];
    }
    if (op === "save") {
      const tracks = payload.tracks || [];
      const error = playlistError(tracks);
      if (error) return [{ ok: false, error }, 400];
      const name = String(payload.name || "").split(/\s+/).filter(Boolean).join(" ").slice(0, 80) || "Untitled";
      const items = readForms();
      const stored = tracks.map((item) => ({ discId: item.discId, n: item.n }));
      let id = String(payload.id || "");
      const found = items.find((item) => item.id === id);
      if (found) {
        found.name = name;
        found.tracks = stored;
      } else {
        id = Math.random().toString(16).slice(2, 14);
        items.push({ id, name, tracks: stored });
      }
      writeForms(items);
      syncPlaylist({ id, name, items: orderedDraft(stored) }).catch(() => {});
      return [{ ok: true, id, playlists: publicForms() }];
    }
    if (op === "delete") {
      writeForms(readForms().filter((item) => item.id !== String(payload.id || "")));
      return [{ ok: true, playlists: publicForms() }];
    }
    return [{ ok: false, error: "Unknown request." }, 404];
  }

  /* ---- sound: a hosted recording, or a slow breath. Never the microphone. ----
     The <audio> element stays on the system output. Wiring that element into
     a live audio graph is what would let the page read samples as they play,
     and on iOS that also drops the lock-screen session the element already
     has. An offline decode of a second copy reads the shape without touching
     playback. Spotify cannot be read, so those sits use the breath. */

  let level = 0;
  let studied = null;
  let studyToken = 0;

  function breathTarget() {
    // About eight seconds in, eight seconds out.
    return 0.22 + 0.14 * Math.sin((performance.now() / 8000) * Math.PI * 2);
  }

  function musicNow() {
    const audio = recorded.audio;
    if (!audio || !studied || audio.paused || audio.ended) return null;
    const key = audio.currentSrc || audio.src;
    if (!key || key !== studied.key) return null;
    const x = (audio.currentTime || 0) * studied.rate;
    const i = Math.floor(x);
    if (i < 0 || i >= studied.values.length) return null;
    const a = studied.values[i];
    const b = studied.values[Math.min(i + 1, studied.values.length - 1)];
    return a + (b - a) * (x - i);
  }

  function sampleLevel() {
    const heard = musicNow();
    const target = heard == null ? breathTarget() : heard;
    level = level * 0.9 + target * 0.1;
    return level;
  }

  function studyRecording(url) {
    const Practice = window.YantraPractice;
    const Context = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!url || !Practice || !Context) return;
    const key = new URL(url, location.href).href;
    if (studied && studied.key === key) return;
    const token = ++studyToken;
    studied = null;
    const run = () => {
      realFetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error("unreadable"))))
        .then((bytes) => new Context(1, 1, 44100).decodeAudioData(bytes))
        .then((audioBuffer) => {
          if (token !== studyToken) return;
          const channels = [];
          for (let c = 0; c < audioBuffer.numberOfChannels; c += 1) channels.push(audioBuffer.getChannelData(c));
          const env = Practice.envelopeFromChannel(channels, audioBuffer.sampleRate, 8);
          if (token !== studyToken || !env.values.length) return;
          studied = { key, rate: env.rate, values: env.values };
        })
        .catch(() => {});
    };
    // Let the tap's play() take the media session before any decode starts.
    setTimeout(run, 400);
  }

  /* ---- answering the page ---- */

  const NOW = {
    connected: false, status: "Stopped", title: "", artist: "", album: "", track: 0, length: 0,
    position: 0, art: "", discId: "", onSamurai: false, source: "", allowed: false, blocked: false,
    blockedTitle: "", blockedArtist: "", installed: {}, form: "", formIndex: 0, formTotal: 0,
    formPlan: [], chakra: "", notice: "", moving: false,
  };

  function reply(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  function readBody(init) {
    try { return JSON.parse((init && init.body) || "{}"); } catch (e) { return {}; }
  }

  /* Music opens in one named tab, so each new album or song replaces the last. */
  function openPlayer(url) {
    window.open(url, "yantra-player");
  }

  /* A form on the web: each song opens on its own in the player tab. A browser
     only opens a page on a tap, so when a song ends the next one waits on the
     Next button. The caption follows the form as the desktop does. */
  const queue = { name: "", items: [], index: -1, prefer: "spotify", startedAt: 0 };

  function songLink(item, prefer) {
    const row = (links[item.discId] || {})[String(item.n)] || {};
    const order = prefer === "apple" ? ["apple", "spotify"] : ["spotify", "apple"];
    for (const name of order) if (row[name] && (name !== "apple" || APPLE_MUSIC)) return row[name];
    return "";
  }

  /* Song lengths in form order; the page paces the drawing with them. */
  function planOf(items) {
    return items.map((item) => (DISCS[item.discId].tracks.find((row) => row.n === item.n) || {}).length || 0);
  }

  function publishSong() {
    const item = queue.items[queue.index];
    if (!item) return;
    const disc = DISCS[item.discId];
    const track = disc.tracks.find((row) => row.n === item.n);
    Object.assign(NOW, {
      connected: true, status: "Playing", title: track.title, artist: disc.artist, album: disc.title,
      track: item.n, length: track.length || 0, position: 0, discId: disc.id, allowed: true,
      form: queue.name, formIndex: queue.index, formTotal: queue.items.length,
      formPlan: planOf(queue.items), chakra: chakraOf(disc, item.n), source: queue.prefer,
    });
    queue.startedAt = performance.now();
  }

  function playSong(index) {
    const item = queue.items[index];
    if (!item) return false;
    const url = songLink(item, queue.prefer);
    if (!url) return false;
    queue.index = index;
    openPlayer(url);
    publishSong();
    paintNext();
    return true;
  }

  function stopQueue() {
    queue.items = [];
    queue.index = -1;
    if (live.service) return;
    Object.assign(NOW, {
      connected: false, status: "Stopped", title: "", artist: "", album: "", track: 0, length: 0,
      position: 0, discId: "", allowed: false, form: "", formIndex: 0, formTotal: 0, chakra: "", source: "",
    });
    paintNext();
  }

  let nextButton = null;
  function paintNext() {
    if (!nextButton) return;
    const next = queue.items[queue.index + 1];
    if (!next) {
      nextButton.hidden = true;
      return;
    }
    const disc = DISCS[next.discId];
    const track = disc.tracks.find((row) => row.n === next.n);
    const length = Number(NOW.length) || 0;
    const done = length > 0 && (performance.now() - queue.startedAt) / 1000 >= length;
    nextButton.hidden = false;
    nextButton.classList.toggle("due", done);
    nextButton.textContent = (done ? "Next  ·  " : "Next song  ·  ") + track.title;
  }
  let noteListening = function () {};
  setInterval(() => {
    if (queue.index >= 0) {
      NOW.position = Math.min(Number(NOW.length) || 0, (performance.now() - queue.startedAt) / 1000);
      paintNext();
      if (!live.service) noteListening(NOW.status === "Playing", queue.items[queue.index], NOW.position);
    }
  }, 1000);


  /* ---- playing inside the page ----
     With a connected account the songs play right here: Spotify through its Web
     Playback SDK (or the listener's open Spotify app), Apple Music through MusicKit.
     The page follows each song and advances on its own, so the eyes stay on the
     yantra. Without a connection, the tab and Next button above still work. */

  function randomText(length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("");
  }
  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const returnTo = () => location.origin + location.pathname;
  const Offer = window.YantraOffer || {
    classify() { return "failed"; },
    line() { return "Spotify didn't start. Choose a hosted album to begin."; },
    hostedAlbums(discs) { return (discs || []).map((disc) => ({ id: disc.id, title: disc.title, circle: disc.circle || "" })); },
  };

  function failureKind(status, reason, message) {
    return Offer.classify(status, reason, message);
  }
  async function failureKindFrom(response) {
    let body = {};
    try { body = await response.json(); } catch (e) {}
    const error = body.error || {};
    return failureKind(response.status, error.reason || "", error.message || "");
  }

  const spotify = {
    token: null,
    deviceId: "",
    player: null,
    sdk: false,
    sdkFailed: false,
    elsewhere: "",
    blocked: "",
    checked: false,
    lastFailure: "",
    sessionFailed: false,
    handset: false,
    load() {
      try { this.token = JSON.parse(localStorage.getItem("yantra.spotify") || "null"); } catch (e) {}
    },
    save() {
      try { localStorage.setItem("yantra.spotify", JSON.stringify(this.token)); } catch (e) {}
    },
    available() { return !!config.spotifyClientId; },
    connected() { return this.available() && !!(this.token && this.token.refresh); },
    async connect() {
      const verifier = randomText(64);
      const state = randomText(16);
      sessionStorage.setItem("yantra.verifier", verifier);
      sessionStorage.setItem("yantra.state", state);
      const query = new URLSearchParams({
        client_id: config.spotifyClientId,
        response_type: "code",
        redirect_uri: returnTo(),
        code_challenge_method: "S256",
        code_challenge: await challengeFor(verifier),
        state,
        scope: "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-modify-private",
      });
      location.href = "https://accounts.spotify.com/authorize?" + query;
    },
    async tokenRequest(fields) {
      const response = await realFetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(Object.assign({ client_id: config.spotifyClientId }, fields)),
      });
      if (!response.ok) return false;
      const data = await response.json();
      this.token = {
        user: this.token && this.token.user,
        name: this.token && this.token.name,
        access: data.access_token,
        refresh: data.refresh_token || (this.token && this.token.refresh),
        expires: Date.now() + (data.expires_in - 60) * 1000,
      };
      this.save();
      return true;
    },
    async finish(code, state) {
      if (state !== sessionStorage.getItem("yantra.state")) return;
      await this.tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: returnTo(),
        code_verifier: sessionStorage.getItem("yantra.verifier") || "",
      });
      sessionStorage.removeItem("yantra.verifier");
      sessionStorage.removeItem("yantra.state");
    },
    async access() {
      if (!this.connected()) return "";
      if (Date.now() > this.token.expires) {
        if (!(await this.tokenRequest({ grant_type: "refresh_token", refresh_token: this.token.refresh }))) {
          this.token = null;
          this.save();
          return "";
        }
      }
      return this.token.access;
    },
    async api(method, path, body) {
      const token = await this.access();
      if (!token) return null;
      return realFetch("https://api.spotify.com/v1" + path, {
        method,
        headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined,
      }).catch(() => null);
    },
    startSdk() {
      if (!Playback.spotifySdkSupported(navEnv())) return;
      if (this.sdk || !this.connected()) return;
      this.sdk = true;
      window.onSpotifyWebPlaybackSDKReady = () => {
        this.player = new window.Spotify.Player({
          name: "Yantra",
          getOAuthToken: (give) => this.access().then(give),
          volume: 0.8,
        });
        this.player.addListener("ready", ({ device_id }) => { this.deviceId = device_id; });
        this.player.addListener("not_ready", () => { this.deviceId = ""; });
        // Without these the player can fail quietly and the music goes nowhere.
        for (const name of ["initialization_error", "authentication_error", "account_error"]) {
          this.player.addListener(name, ({ message }) => {
            this.sdkFailed = true;
            this.deviceId = "";
            const why = failureKind(0, "", message || "");
            if (why === "premium") this.blocked = "premium";
            else if (why === "unlisted") this.noteUnlisted();
            else this.lastFailure = "sdk";
            console.warn("Yantra: Spotify player " + name + ": " + message);
          });
        }
        this.player.connect();
      };
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.head.appendChild(script);
    },
    noteUnlisted() {
      this.blocked = "unlisted";
      this.lastFailure = "unlisted";
      this.token = null;
      this.save();
      try { localStorage.setItem("yantra.spotifyNote", "unlisted"); } catch (e) {}
    },
    clearNote() {
      if (this.blocked === "unlisted") this.blocked = "";
      try { localStorage.removeItem("yantra.spotifyNote"); } catch (e) {}
    },
    /* One check per page. A 403 means this account is not allowed to use the app
       (Development Mode's listener list). A free account is told apart from that. */
    async ensureListener() {
      if (this.checked) return this.blocked || "";
      this.checked = true;
      if (!this.connected()) return "offline";
      const response = await this.api("GET", "/me");
      if (!response) return "";
      if (response.status === 403) {
        const why = await failureKindFrom(response);
        if (why === "premium") {
          this.blocked = "premium";
          this.lastFailure = "premium";
          return "premium";
        }
        this.noteUnlisted();
        return "unlisted";
      }
      if (!response.ok) return "";
      const me = await response.json().catch(() => ({}));
      if (me.id) {
        this.token.user = me.id;
        this.token.name = String(me.display_name || this.token.name || "").slice(0, 80);
        this.token.product = me.product || "";
        this.save();
      }
      this.clearNote();
      if (me.product && me.product !== "premium") {
        this.blocked = "premium";
        this.lastFailure = "premium";
        return "premium";
      }
      this.blocked = "";
      return "";
    },
    async outputDevice() {
      const list = await this.api("GET", "/me/player/devices");
      const devices = list && list.ok ? ((await list.json().catch(() => ({}))).devices || []) : [];
      const usable = devices.filter((device) => !device.is_restricted && device.name !== "Yantra");
      return usable.find((device) => device.type === "Smartphone") || usable.find((device) => device.is_active) || usable[0] || null;
    },
    async play(body) {
      this.elsewhere = "";
      this.lastFailure = "";
      if (this.blocked === "unlisted" || this.blocked === "premium") {
        this.lastFailure = this.blocked;
        return false;
      }
      if (this.sessionFailed) {
        this.lastFailure = "sdk";
        return false;
      }
      // Phones cannot host the in-page player. Never register it there: that device
      // accepts play() and then sits at position 0 with no sound. Use a real
      // Spotify app that is already open, the phone first.
      if (!Playback.spotifySdkSupported(navEnv())) {
        const pick = await this.outputDevice();
        this.handset = !!pick;
        if (!pick) {
          this.lastFailure = "sdk";
          return false;
        }
        const target = "?device_id=" + pick.id;
        const response = await this.api("PUT", "/me/player/play" + target, body);
        if (response && response.status === 403) {
          const why = await failureKindFrom(response);
          if (why === "premium") {
            this.blocked = "premium";
            this.lastFailure = "premium";
          } else {
            this.noteUnlisted();
          }
          return false;
        }
        if (!response || !(response.ok || response.status === 204)) {
          this.lastFailure = "failed";
          return false;
        }
        this.deviceId = pick.id;
        this.elsewhere = pick.name;
        const device = "&" + target.slice(1);
        this.api("PUT", "/me/player/shuffle?state=false" + device);
        this.api("PUT", "/me/player/repeat?state=off" + device);
        return true;
      }
      // A tap soon after the page opens can come before the in-page player is ready.
      for (let waited = 0; this.sdk && !this.deviceId && !this.sdkFailed && waited < 5000; waited += 250) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (this.blocked === "unlisted" || this.blocked === "premium") {
        this.lastFailure = this.blocked;
        return false;
      }
      let target = this.deviceId ? "?device_id=" + this.deviceId : "";
      let response = await this.api("PUT", "/me/player/play" + target, body);
      if (response && response.status === 404 && this.deviceId) {
        // The in-page player went stale; wake it and try once more.
        await this.player.connect();
        response = await this.api("PUT", "/me/player/play" + target, body);
      }
      if (response && response.status === 404) {
        // Phones cannot host the in-page player. Play on the listener's Spotify app
        // (the phone first), as long as it has been opened recently. Yantra players
        // in other windows are passed over, so the music never goes somewhere unseen.
        const list = await this.api("GET", "/me/player/devices");
        const devices = list && list.ok ? ((await list.json().catch(() => ({}))).devices || []) : [];
        const usable = devices.filter((device) => !device.is_restricted && device.name !== "Yantra");
        const pick = usable.find((device) => device.type === "Smartphone") || usable.find((device) => device.is_active) || usable[0];
        if (pick) {
          target = "?device_id=" + pick.id;
          response = await this.api("PUT", "/me/player/play" + target, body);
          this.elsewhere = pick.name;
        }
      }
      if (response && response.status === 403) {
        const why = await failureKindFrom(response);
        if (why === "premium") {
          this.blocked = "premium";
          this.lastFailure = "premium";
        } else {
          this.noteUnlisted();
        }
        return false;
      }
      if (!response || !(response.ok || response.status === 204)) {
        this.lastFailure = this.sdkFailed ? (this.lastFailure || "sdk") : "failed";
        return false;
      }
      const device = target ? "&" + target.slice(1) : "";
      this.api("PUT", "/me/player/shuffle?state=false" + device);
      this.api("PUT", "/me/player/repeat?state=off" + device);
      return true;
    },
    async state() {
      const response = await this.api("GET", "/me/player");
      if (!response || response.status !== 200) return null;
      const data = await response.json().catch(() => null);
      if (!data || !data.item) return null;
      return {
        key: data.item.uri,
        position: (data.progress_ms || 0) / 1000,
        length: (data.item.duration_ms || 0) / 1000,
        playing: !!data.is_playing,
      };
    },
    pause() { this.api("PUT", "/me/player/pause" + (this.deviceId ? "?device_id=" + this.deviceId : "")); },
  };

  const apple = {
    music: null,
    loading: null,
    available() { return APPLE_MUSIC && !!config.appleDeveloperToken; },
    connected() { return !!(this.music && this.music.isAuthorized); },
    load() {
      if (!this.available()) return Promise.resolve();
      if (!this.loading) {
        this.loading = new Promise((resolve) => {
          document.addEventListener("musickitloaded", async () => {
            try {
              this.music = await window.MusicKit.configure({
                developerToken: config.appleDeveloperToken,
                app: { name: "Yantra", build: "1.0" },
              });
            } catch (e) {}
            paintConnect();
            resolve();
          });
          const script = document.createElement("script");
          script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
          script.async = true;
          document.head.appendChild(script);
        });
      }
      return this.loading;
    },
    async connect() {
      await this.load();
      if (this.music) await this.music.authorize().catch(() => {});
    },
    async play(queueOptions) {
      await this.load();
      if (!this.music) return false;
      if (!this.music.isAuthorized) await this.music.authorize().catch(() => {});
      if (!this.music.isAuthorized) return false;
      try {
        this.music.shuffleMode = 0;
        this.music.repeatMode = 0;
        await this.music.setQueue(Object.assign({ startPlaying: true }, queueOptions));
        if (!this.music.isPlaying) await this.music.play();
        return true;
      } catch (e) {
        return false;
      }
    },
    state() {
      const music = this.music;
      const item = music && music.nowPlayingItem;
      if (!item) return null;
      return {
        key: String(item.id),
        position: music.currentPlaybackTime || 0,
        length: music.currentPlaybackDuration || 0,
        playing: !!music.isPlaying,
      };
    },
    pause() { if (this.music) this.music.pause(); },
  };

  /* The sangha recordings: one <audio> element walks the list in order. */
  const recorded = {
    audio: null,
    keys: [],
    index: -1,
    token: 0,
    onfail: null,
    heardAt: 0,
    available() { return Object.keys(recordings).length > 0; },
    connected() { return this.available(); },
    element() {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.addEventListener("ended", () => {
          const next = this.index + 1;
          if (next >= this.keys.length) return;
          this.start(next).then((ok) => {
            if (!ok && this.onfail) this.onfail(next, "rejected");
          });
        });
        this.audio.addEventListener("error", () => {
          if (this.onfail && this.index >= 0) this.onfail(this.index, "error");
        });
        this.audio.addEventListener("timeupdate", () => { this.heardAt = Date.now(); });
      }
      return this.audio;
    },
    start(index) {
      const audio = this.element();
      this.index = index;
      const token = ++this.token;
      audio.src = this.keys[index];
      studyRecording(this.keys[index]);
      return audio.play().then(() => this.token === token, () => false);
    },
    play(keys) {
      this.keys = keys.slice();
      return this.start(0);
    },
    state() {
      const audio = this.audio;
      if (!audio || this.index < 0) return null;
      return {
        key: this.keys[this.index],
        position: audio.currentTime || 0,
        length: Number.isFinite(audio.duration) ? audio.duration : 0,
        playing: !audio.paused && !audio.ended,
      };
    },
    pause() { if (this.audio) this.audio.pause(); },
  };

  /* Each song's key on each service, read from its direct link. */
  function playbackSession() {
    return {
      sdk: Playback.spotifySdkSupported(navEnv()) && !spotify.sessionFailed,
      connected: spotify.connected() && !spotify.sessionFailed,
      handset: !!spotify.handset,
      blocked: spotify.blocked === "unlisted" || spotify.blocked === "premium",
      failed: !!spotify.sessionFailed,
      failedKeys: failedKeys,
      level: window.YANTRA_LEVEL || "",
    };
  }

  function itemPlayable(item) {
    const disc = item && DISCS[item.discId];
    if (closedDisc(disc)) return false;
    return Playback.trackOffered({
      key: item.discId + "#" + item.n,
      circle: disc.circle,
      hosted: !!recordingOf(item.discId, item.n),
      spotify: !!songKey(item, "spotify"),
    }, playbackSession());
  }

  function songKey(item, service) {
    if (service === "recordings") return recordingOf(item.discId, item.n);
    const url = ((links[item.discId] || {})[String(item.n)] || {})[service] || "";
    if (service === "spotify") {
      const match = url.match(/\/track\/([A-Za-z0-9]+)/);
      return match ? "spotify:track:" + match[1] : "";
    }
    const match = url.match(/[?&]i=(\d+)/);
    return match ? match[1] : "";
  }

  const services = { recordings: recorded, spotify, apple };
  const recordedAll = (items) => items.length > 0 && items.every((item) => recordingOf(item.discId, item.n));
  const live = { service: null, name: "", items: [], keys: [], seen: false, timer: 0, form: false, chakras: null, lastHeard: false, recovering: false };
  const progressWatch = Playback.createProgressWatch(Playback.STALL_MS);

  /* The morning and evening sets: 1 song is the heart song, 3 is one per chakra,
     6 is two per chakra, 12 is four per chakra, always navel, heart, third eye. */
  function sessionItems(theme, count) {
    const set = sets && sets[theme];
    if (!set) return null;
    if (count === 1) {
      const one = sets.oneSong && sets.oneSong[theme];
      return one ? recordedSit([{ discId: one.discId, n: one.n, chakra: "heart" }]) : null;
    }
    const per = { 3: 1, 6: 2, 12: 4 }[count];
    if (!per) return null;
    const items = [];
    for (const chakra of ["naval", "heart", "eye"]) {
      for (const song of (set[chakra] || []).slice(0, per)) items.push({ discId: song.discId, n: song.n, chakra });
    }
    return items.length === per * 3 ? recordedSit(items) : null;
  }

  /* A sit stays inside one album, as the sangha listens. Each album runs from navel
     songs through heart songs to third eye songs, so a sit takes the same number
     from each third, in the album's own order; one song is a heart song. With no
     album chosen, each sit brings a different one, recorded ones first until
     Spotify is connected. */
  function albumFits(disc, count) {
    if (closedDisc(disc)) return false;
    const offered = (track, chakra) => chakraOf(disc, track.n) === chakra && itemPlayable({ discId: disc.id, n: track.n });
    const sizes = CHAKRAS.map((chakra) => disc.tracks.filter((track) => offered(track, chakra)).length);
    if (!sizes.some((size) => size > 0)) return false;
    const per = count === 1 ? 0 : count / 3;
    return count === 1 ? sizes[1] > 0 : sizes.every((size) => size >= per);
  }
  function albumSit(count, discId) {
    if (![1, 3, 6, 12].includes(count)) return null;
    let disc = DISCS[discId];
    if (disc && !albumFits(disc, count)) return null;
    if (!disc) {
      const fits = collection.discs.filter((item) => albumFits(item, count));
      const recordedOnly = fits.filter(onRecordings);
      let pool = spotify.connected() || !recordedOnly.length ? fits : recordedOnly;
      let last = "";
      try { last = localStorage.getItem("yantra.lastAlbum") || ""; } catch (e) {}
      if (pool.length > 1) pool = pool.filter((item) => item.id !== last);
      if (!pool.length) return null;
      disc = sample(pool, 1)[0];
    }
    try { localStorage.setItem("yantra.lastAlbum", disc.id); } catch (e) {}
    const per = count === 1 ? 1 : count / 3;
    const items = [];
    for (const chakra of count === 1 ? ["heart"] : CHAKRAS) {
      const songs = disc.tracks.filter((track) => chakraOf(disc, track.n) === chakra && itemPlayable({ discId: disc.id, n: track.n }));
      for (const track of sample(songs, per).sort((a, b) => a.n - b.n)) items.push({ discId: disc.id, n: track.n, chakra });
    }
    return items;
  }

  /* The curated sets draw on albums the sangha has no recordings of. Where a song
     isn't recorded, a recorded song for the same chakra takes its place, so a sit
     plays from the sangha's copies without needing Spotify. */
  function recordedSit(items) {
    if (recordedAll(items)) return items;
    const used = new Set(items.map((item) => item.discId + "#" + item.n));
    return items.map((item) => {
      if (recordingOf(item.discId, item.n)) return item;
      const options = recordedPool(item.chakra).filter(([discId, n]) => !used.has(discId + "#" + n));
      if (!options.length) return item;
      const [discId, n] = sample(options, 1)[0];
      used.add(discId + "#" + n);
      return { discId, n, chakra: item.chakra };
    });
  }

  function complete() {
    dispatchEvent(new Event("yantra:complete"));
  }

  function serviceFor(items, prefer) {
    // The sangha's own copies come first: they need no account and no app.
    const order = ["recordings"].concat(prefer === "apple" ? ["apple", "spotify"] : ["spotify", "apple"]);
    for (const name of order) {
      if (services[name].connected() && items.every((item) => songKey(item, name))) return name;
    }
    return "";
  }

  function liveStop(pause) {
    if (live.service && pause) services[live.service].pause();
    clearInterval(live.timer);
    clearTimeout(live.endTimer);
    live.endTimer = 0;
    live.service = null;
    live.items = [];
    live.keys = [];
    live.seen = false;
  }

  function markFailed(item, fromSpotify) {
    if (!item) return;
    failedKeys[item.discId + "#" + item.n] = true;
    if (fromSpotify) {
      spotify.sessionFailed = true;
      spotify.handset = false;
    }
  }

  function showSkipLine(text) {
    if (!nextButton || !text) return;
    nextButton.hidden = false;
    nextButton.classList.remove("due");
    nextButton.textContent = text;
    nextButton.onclick = () => { nextButton.hidden = true; nextButton.onclick = null; };
    setTimeout(() => { if (nextButton.textContent === text) nextButton.click(); }, 6000);
  }

  function giveUp(line) {
    const offer = makeOffer({
      reason: spotify.sessionFailed ? "sdk" : (spotify.lastFailure || "failed"),
      mode: "session",
      theme: sitTheme || "morning",
      count: live.items.length || 3,
    });
    offer.text = line + (offer.albums.length ? " Choose a hosted album to begin." : "");
    NOW.notice = offer.text;
    NOW.status = "Stopped";
    NOW.moving = false;
    NOW.connected = false;
    showSkipLine(line);
    liveStop(true);
    dispatchEvent(new CustomEvent("yantra:unplayed", { detail: offer }));
    dispatchEvent(new Event("yantra:shelf"));
  }

  async function skipFrom(index, reason) {
    if (!live.service || live.recovering) return;
    live.recovering = true;
    try {
      const fromSpotify = live.service === "spotify";
      markFailed(live.items[index], fromSpotify);
      if (fromSpotify) {
        const line = Playback.calmLine(false);
        NOW.notice = line;
        NOW.moving = false;
        NOW.status = "Starting";
        giveUp(line);
        return;
      }
      let cursor = index;
      while (live.service) {
        const next = Playback.nextPlayable(live.items, cursor, (row) => {
          if (!itemPlayable(row)) return false;
          if (live.service === "recordings") return !!recordingOf(row.discId, row.n);
          return false;
        });
        const line = Playback.calmLine(next >= 0);
        NOW.notice = line;
        NOW.moving = false;
        NOW.status = "Starting";
        if (next < 0) {
          giveUp(line);
          return;
        }
        const ok = await recorded.start(next);
        if (ok) {
          progressWatch.reset();
          showSkipLine(line);
          dispatchEvent(new Event("yantra:shelf"));
          return;
        }
        markFailed(live.items[next], false);
        cursor = next;
      }
    } finally {
      live.recovering = false;
    }
  }

  async function livePoll() {
    if (!live.service) return;
    const state = await services[live.service].state();
    if (!live.service || !state) return;
    noteListening(!!state.playing, { discId: state.key, n: "" }, state.position, state.key);
    const index = live.keys.indexOf(state.key);
    if (index < 0) {
      // The list has finished and the service went on to something else.
      if (live.seen) {
        services[live.service].pause();
        NOW.status = "Stopped";
        const finished = live.lastHeard;
        liveStop(false);
        if (finished) complete();
      }
      return;
    }
    live.seen = true;
    const item = live.items[index];
    const disc = DISCS[item.discId];
    const track = disc.tracks.find((row) => row.n === item.n);
    const last = index === live.items.length - 1;
    if (last && state.playing) live.lastHeard = true;
    // A hard stop: pause a breath before the last song runs out, so Spotify's autoplay
    // never sounds the first notes of a song from outside the sit.
    const remaining = (state.length || 0) - (state.position || 0);
    if (last && state.playing && state.length > 0 && remaining < 3 && !live.endTimer) {
      const service = live.service;
      live.endTimer = setTimeout(() => {
        if (live.service !== service) return;
        services[service].pause();
        NOW.status = "Stopped";
        liveStop(false);
        complete();
      }, Math.max(0, (remaining - 0.3) * 1000));
    }
    // The last song has run out and Spotify stopped on it: the sit is complete.
    if (last && live.lastHeard && !state.playing && (state.position < 1 || state.position >= state.length - 1.5)) {
      NOW.status = "Stopped";
      liveStop(false);
      complete();
      return;
    }
    const watch = progressWatch.sample(state.key, state.position, state.playing, Date.now());
    if (watch.stalled) {
      await skipFrom(index, "stall");
      return;
    }
    const shown = Playback.presentState(state, watch);
    if (shown.status === "Playing") NOW.notice = "";
    Object.assign(NOW, {
      connected: true,
      status: shown.status,
      moving: shown.moving,
      notice: NOW.notice,
      title: track.title, artist: disc.artist, album: disc.title, track: item.n,
      length: state.length || track.length || 0, position: state.position,
      discId: disc.id, allowed: true, source: live.service,
      form: live.form ? live.name : "", formIndex: live.form ? index : 0,
      formTotal: live.form ? live.items.length : 0, chakra: live.form ? ((live.chakras && live.chakras[index]) || chakraOf(disc, item.n)) : "",
      formPlan: live.form ? planOf(live.items) : [],
    });
  }

  /* Each saved form has a private playlist in the listener's own Spotify library,
     named "Yantra · <form name>". Saving or sitting the form brings it up to date. */
  function listsKey() {
    return "yantra.lists." + ((spotify.token && spotify.token.user) || "guest");
  }
  async function syncPlaylist(form) {
    if (!spotify.connected() || !form.id) return "";
    const uris = form.items.map((item) => songKey(item, "spotify"));
    if (!uris.length || uris.some((uri) => !uri)) return "";
    let map = {};
    try { map = JSON.parse(localStorage.getItem(listsKey()) || "{}") || {}; } catch (e) {}
    const title = "Yantra · " + form.name;
    let id = map[form.id] || "";
    if (id) {
      const replaced = await spotify.api("PUT", "/playlists/" + id + "/items", { uris });
      if (replaced && replaced.ok) {
        spotify.api("PUT", "/playlists/" + id, { name: title });
        return id;
      }
      id = "";
    }
    const made = await spotify.api("POST", "/me/playlists", {
      name: title,
      public: false,
      description: "Made in Yantra: naval, heart and third eye, in order.",
    });
    if (!made || !made.ok) return "";
    id = ((await made.json().catch(() => ({}))).id) || "";
    if (!id) return "";
    const filled = await spotify.api("PUT", "/playlists/" + id + "/items", { uris });
    if (!filled || !filled.ok) return "";
    map[form.id] = id;
    try { localStorage.setItem(listsKey(), JSON.stringify(map)); } catch (e) {}
    return id;
  }

  let resume = null;
  function showResume(text, action) {
    if (!resume) return;
    resume.querySelector("span").textContent = text;
    const go = resume.querySelector("button");
    go.hidden = !action;
    go.onclick = () => {
      resume.hidden = true;
      if (action) action();
    };
    resume.hidden = false;
  }
  function offerPending() {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem("yantra.pending") || "null"); } catch (e) {}
    sessionStorage.removeItem("yantra.pending");
    if (!pending || !spotify.connected()) return;
    showResume("Spotify is connected.", () => {
      if (pending.kind === "session" && typeof window.playSession === "function") {
        window.playSession(pending.theme, pending.count, { mix: !!pending.mix, album: pending.album || "" });
      } else if (pending.kind === "form" && typeof window.playForm === "function") {
        window.playForm(pending.name, pending.id, pending.tracks);
      } else if (pending.kind === "album") {
        window.fetch("/play", { method: "POST", body: JSON.stringify({ id: pending.id, source: "spotify" }) });
        if (typeof window.begin === "function") window.begin();
      }
    });
    resume.querySelector("button").textContent = "Begin " + (pending.name || "the sit");
  }

  /* Back, restart and next during a sit, so a song never has to be waited out.
     Back returns to the previous song; on the first song it starts it over. */
  const transport = {
    async step(delta) {
      if (live.service === "recordings") {
        const target = recorded.index + delta;
        if (target >= recorded.keys.length) return false;
        return recorded.start(Math.max(0, target));
      }
      if (live.service === "spotify") {
        const device = spotify.deviceId ? "?device_id=" + spotify.deviceId : "";
        return !!(await spotify.api("POST", "/me/player/" + (delta > 0 ? "next" : "previous") + device));
      }
      if (live.service === "apple" && apple.music) {
        try { await (delta > 0 ? apple.music.skipToNextItem() : apple.music.skipToPreviousItem()); return true; } catch (e) { return false; }
      }
      if (queue.items.length) return playSong(Math.min(queue.items.length - 1, Math.max(0, queue.index + delta)));
      return false;
    },
    next() { return this.step(1); },
    back() { return this.step(-1); },
    async restart() {
      if (live.service === "recordings" && recorded.audio) {
        recorded.audio.currentTime = 0;
        if (recorded.audio.paused) recorded.audio.play().catch(() => {});
        return true;
      }
      if (live.service === "spotify") {
        const device = spotify.deviceId ? "&device_id=" + spotify.deviceId : "";
        return !!(await spotify.api("PUT", "/me/player/seek?position_ms=0" + device));
      }
      if (live.service === "apple" && apple.music) {
        try { await apple.music.seekToTime(0); return true; } catch (e) { return false; }
      }
      if (queue.index >= 0) return playSong(queue.index);
      return false;
    },
  };
  window.yantraTransport = transport;

  /* Starts the list in the page. Resolves true only once sound is actually going,
     so a sit is never opened on a player that stayed silent. */
  async function liveStart(name, items, prefer, form, albumOptions, formId, chakras) {
    const service = serviceFor(items, prefer);
    if (!service) return false;
    liveStop(true);
    stopQueue();
    Object.assign(live, {
      service, name, items, keys: items.map((item) => songKey(item, service)), seen: false, form,
      chakras: chakras || null, lastHeard: false,
    });
    // Unlocks audio for the in-page player; it has to run inside the tap.
    if (service === "spotify" && spotify.player && spotify.player.activateElement) spotify.player.activateElement();
    let started;
    if (service === "recordings") {
      started = (async () => {
        recorded.keys = live.keys.slice();
        recorded.onfail = null;
        live.recovering = true;
        try {
          for (let i = 0; i < live.items.length; i += 1) {
            if (!recordingOf(live.items[i].discId, live.items[i].n)) {
              markFailed(live.items[i], false);
              continue;
            }
            const playing = await recorded.start(i);
            if (playing) {
              progressWatch.reset();
              return true;
            }
            markFailed(live.items[i], false);
            NOW.notice = Playback.calmLine(live.items.slice(i + 1).some((item) => recordingOf(item.discId, item.n)));
          }
          return false;
        } finally {
          live.recovering = false;
        }
      })();
    } else if (service === "spotify" && albumOptions && albumOptions.spotify) {
      started = spotify.play(albumOptions.spotify);
    } else if (service === "spotify") {
      // A saved form plays from its own private Spotify playlist, so the songs keep
      // going in order on Spotify even if this page is closed or the phone sleeps.
      started = (async () => {
        const playlist = formId ? await syncPlaylist({ id: formId, name, items }).catch(() => "") : "";
        return spotify.play(playlist ? { context_uri: "spotify:playlist:" + playlist } : { uris: live.keys });
      })();
    } else {
      started = apple.play(albumOptions && albumOptions.apple ? albumOptions.apple : { songs: live.keys });
    }
    const ok = await started;
    if (!ok || live.service !== service) {
      if (live.service === service) liveStop(false);
      return false;
    }
    progressWatch.reset();
    if (service === "recordings") recorded.onfail = (index, reason) => { skipFrom(index, reason); };
    if (service === "spotify" && spotify.elsewhere && nextButton) {
      // Say where the music went, so a quiet page never leaves the listener guessing.
      nextButton.hidden = false;
      nextButton.classList.remove("due");
      nextButton.textContent = "Playing on " + spotify.elsewhere;
      nextButton.onclick = () => { nextButton.hidden = true; nextButton.onclick = null; };
      setTimeout(() => { if (nextButton.textContent.startsWith("Playing on ")) nextButton.click(); }, 8000);
    }
    live.timer = setInterval(livePoll, 1000);
    return true;
  }

  /* The Connect control beside Listen on. */
  let connectButton = null;
  function paintConnect() {
    if (!connectButton) return;
    let choice = "spotify";
    try { if (localStorage.getItem("yantra.listenOn") === "apple") choice = "apple"; } catch (e) {}
    const service = services[choice];
    connectButton.hidden = !service.available();
    connectButton.disabled = service.connected();
    connectButton.textContent = service.connected() ? "Connected" : "Connect";
    connectButton.dataset.service = choice;
  }

  window.yantraSpotify = {
    status() {
      spotify.load();
      let unlisted = spotify.blocked === "unlisted";
      try { if (localStorage.getItem("yantra.spotifyNote") === "unlisted") unlisted = true; } catch (e) {}
      const token = spotify.token || {};
      return {
        available: spotify.available(),
        connected: spotify.connected(),
        name: token.name || "",
        unlisted: unlisted,
      };
    },
    connect() { return spotify.connect(); },
    disconnect() {
      spotify.token = null;
      spotify.deviceId = "";
      spotify.save();
      paintConnect();
    },
    clearUnlisted() { spotify.clearNote(); },
  };

  let notice = "";
  const session = ready.then(async () => {
    spotify.load();
    try {
      if (localStorage.getItem("yantra.spotifyNote") === "unlisted") spotify.blocked = "unlisted";
    } catch (e) {}
    const query = new URLSearchParams(location.search);
    if (query.get("code") && spotify.available()) {
      await spotify.finish(query.get("code"), query.get("state"));
      history.replaceState(null, "", returnTo());
    } else if (query.get("error")) {
      history.replaceState(null, "", returnTo());
    }
    if (spotify.connected()) {
      const who = await spotify.ensureListener();
      if (who === "unlisted") {
        notice = "This Spotify account isn't on Yantra's listener list, so Spotify can't play here. Hosted albums still play.";
      } else if (who === "premium") {
        notice = "Spotify Premium is needed to play in Yantra. Hosted albums still play.";
      }
    }
    // Forms saved before accounts existed move to the first account that connects here.
    try {
      const old = localStorage.getItem("yantra.forms.v1");
      if (old && spotify.connected() && !localStorage.getItem(formsKey())) {
        localStorage.setItem(formsKey(), old);
        localStorage.removeItem("yantra.forms.v1");
      }
    } catch (e) {}
    if (Playback.spotifySdkSupported(navEnv())) {
      spotify.handset = true;
      spotify.startSdk();
    } else if (spotify.connected()) {
      spotify.handset = !!(await spotify.outputDevice());
    }
    apple.load();
    paintConnect();
  });
  session.then(() => {
    const show = () => {
      if (notice) showResume(notice, null);
      else offerPending();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show);
    else show();
  });

  document.addEventListener("DOMContentLoaded", () => {
    const listen = document.getElementById("listen");
    if (listen) {
      connectButton = document.createElement("button");
      connectButton.type = "button";
      connectButton.id = "web-connect";
      connectButton.hidden = true;
      connectButton.addEventListener("click", () => {
        const service = services[connectButton.dataset.service];
        if (service && !service.connected()) service.connect().then(paintConnect);
      });
      listen.appendChild(connectButton);
      listen.querySelectorAll("button[data-source]").forEach((button) => button.addEventListener("click", paintConnect));
      paintConnect();
    }
    resume = document.createElement("div");
    resume.id = "web-resume";
    resume.hidden = true;
    resume.append(document.createElement("span"), document.createElement("button"));
    resume.querySelector("button").type = "button";
    document.body.appendChild(resume);
    nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.id = "web-next";
    nextButton.hidden = true;
    nextButton.addEventListener("click", () => {
      if (!nextButton.onclick) playSong(queue.index + 1);
    });
    document.body.appendChild(nextButton);
    const offerPanel = document.createElement("div");
    offerPanel.id = "music-offer";
    offerPanel.hidden = true;
    offerPanel.setAttribute("role", "dialog");
    offerPanel.setAttribute("aria-label", "Choose a different album");
    offerPanel.innerHTML = [
      '<p data-line></p>',
      '<button type="button" data-connect>Connect Spotify</button>',
      '<button type="button" data-keep>Keep this album</button>',
      '<p data-kicker>Choose a different album</p>',
      '<div data-albums></div>',
    ].join("");
    document.body.appendChild(offerPanel);
    window.yantraMusicOffer = (offer) => paintMusicOffer(offerPanel, offer);
  });

  function paintMusicOffer(panel, offer) {
    if (!panel || !offer) return;
    panel.hidden = false;
    panel.querySelector("[data-line]").textContent = offer.text || Offer.line(offer);
    const connect = panel.querySelector("[data-connect]");
    connect.hidden = !offer.connect;
    connect.onclick = () => {
      const pending = offer.mode === "album"
        ? { kind: "album", name: offer.asked || offer.playing || "the album", id: offer.askedId || offer.playingId || "" }
        : {
          kind: "session",
          theme: offer.theme || "morning",
          count: offer.count || 3,
          name: offer.asked || offer.playing || "the sit",
          mix: false,
          album: offer.askedId || "",
        };
      try { sessionStorage.setItem("yantra.pending", JSON.stringify(pending)); } catch (e) {}
      spotify.connect();
    };
    const keep = panel.querySelector("[data-keep]");
    keep.hidden = !offer.playing;
    keep.onclick = () => { panel.hidden = true; };
    const kicker = panel.querySelector("[data-kicker]");
    const albums = offer.albums || [];
    kicker.hidden = !albums.length;
    const list = panel.querySelector("[data-albums]");
    list.replaceChildren();
    const circles = (collection && collection.circles) || [];
    const groups = {};
    albums.forEach((album) => {
      const key = album.circle || "";
      (groups[key] || (groups[key] = [])).push(album);
    });
    const order = circles.map((circle) => circle.id).filter((id) => groups[id]);
    Object.keys(groups).forEach((id) => { if (order.indexOf(id) < 0) order.push(id); });
    order.forEach((id) => {
      const circle = circles.find((item) => item.id === id);
      if (circle) {
        const label = document.createElement("p");
        label.className = "music-offer-circle";
        label.textContent = circle.name;
        list.append(label);
      }
      groups[id].forEach((album) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = album.id === offer.playingId ? album.title + "  ·  playing" : album.title;
        button.disabled = album.id === offer.playingId;
        button.addEventListener("click", () => {
          panel.hidden = true;
          if (offer.mode === "album" && typeof window.yantraPlayHosted === "function") window.yantraPlayHosted(album.id);
          else if (typeof window.playSession === "function") {
            window.playSession(offer.theme || "morning", offer.count || 3, { mix: false, album: album.id });
          }
        });
        list.append(button);
      });
    });
  }

  /* Already known, without waiting on the network. Unlisted sticks: connecting again
     cannot add an account to Spotify's listener list. Premium is rechecked once a page. */
  function spotifyKnownUnavailable() {
    if (spotify.sessionFailed) return "sdk";
    if (!Playback.spotifySdkSupported(navEnv()) && !spotify.handset) return "sdk";
    if (spotify.blocked === "unlisted") return "unlisted";
    try {
      if (localStorage.getItem("yantra.spotifyNote") === "unlisted") return "unlisted";
    } catch (e) {}
    if (spotify.checked && spotify.blocked === "premium") return "premium";
    if (!spotify.available() || !spotify.connected()) return "offline";
    return "";
  }

  function hostedList(count) {
    return Offer.hostedAlbums(collection.discs, count, onRecordings, (disc) => albumFits(disc, count));
  }

  function makeOffer(fields) {
    const listCount = fields.mode === "session" ? (Number(fields.count) || 3) : 0;
    const offer = {
      reason: fields.reason || "offline",
      connect: !!spotify.available(),
      asked: fields.asked || "",
      askedId: fields.askedId || "",
      playing: fields.playing || "",
      playingId: fields.playingId || "",
      mix: !!fields.mix,
      albums: hostedList(listCount),
      theme: fields.theme || "morning",
      count: Number(fields.count) || 3,
      mode: fields.mode || "session",
    };
    offer.text = Offer.line(offer);
    return offer;
  }

  function describeItems(items) {
    if (!items.length) return { playing: "", playingId: "", mix: false };
    const ids = new Set(items.map((item) => item.discId));
    if (ids.size > 1) return { playing: "Hosted songs", playingId: "", mix: true };
    const disc = DISCS[items[0].discId];
    return { playing: disc ? disc.title : "", playingId: disc ? disc.id : "", mix: false };
  }

  function pickHostedDisc(count, avoid) {
    let pool = collection.discs.filter((disc) => onRecordings(disc) && albumFits(disc, count));
    if (avoid && pool.length > 1) pool = pool.filter((disc) => disc.id !== avoid);
    let last = "";
    try { last = localStorage.getItem("yantra.lastAlbum") || ""; } catch (e) {}
    if (last && pool.length > 1) {
      const narrower = pool.filter((disc) => disc.id !== last);
      if (narrower.length) pool = narrower;
    }
    return pool.length ? sample(pool, 1)[0] : null;
  }

  /* The sit the listener asked for, played from the sangha's copies when Spotify
     cannot. The page hears about the swap and offers Connect plus every hosted album. */
  async function startSession(payload) {
    spotify.load();
    const theme = payload.theme === "evening" ? "evening" : "morning";
    const count = Number(payload.count) || 3;
    const mix = !!payload.mix;
    const albumId = String(payload.album || "");
    const name = String(payload.name || theme);
    const askedDisc = !mix && albumId ? DISCS[albumId] : null;
    if (askedDisc && closedDisc(askedDisc)) {
      const offer = makeOffer({
        reason: "offline",
        asked: askedDisc.title,
        askedId: askedDisc.id,
        theme, count, mode: "session",
      });
      offer.text = "Lumikara is for the Zazen word.";
      return [{ ok: false, error: offer.text, offer }, 409];
    }
    if (askedDisc && !askedDisc.tracks.some((track) => itemPlayable({ discId: askedDisc.id, n: track.n }))) {
      const offer = makeOffer({
        reason: spotifyKnownUnavailable() || "offline",
        asked: askedDisc.title,
        askedId: askedDisc.id,
        theme, count, mode: "session",
      });
      return [{ ok: false, error: offer.text, offer }, 409];
    }
    if (askedDisc && onRecordings(askedDisc)) {
      const picked = albumSit(count, askedDisc.id);
      if (!picked) return [{ ok: false, error: askedDisc.title + " is too short for " + count + " songs." }, 404];
      const items = picked.map((item) => ({ discId: item.discId, n: item.n }));
      const ok = await liveStart(name, items, "recordings", true, null, "", picked.map((item) => item.chakra));
      return ok ? [{ ok: true, source: "session" }] : [{ ok: false, error: "The music did not start." }, 404];
    }

    let unavailable = spotifyKnownUnavailable();
    let picked = mix ? sessionItems(theme, count) : albumSit(count, albumId);
    if (!picked) {
      return [{ ok: false, error: askedDisc ? askedDisc.title + " is too short for " + count + " songs." : "That sit is not available." }, 404];
    }
    let items = picked.map((item) => ({ discId: item.discId, n: item.n }));
    let chakras = picked.map((item) => item.chakra);

    if (!unavailable && !recordedAll(items)) {
      if (spotify.connected()) {
        const who = await spotify.ensureListener();
        if (who === "unlisted" || who === "premium") unavailable = who;
        else if (!spotify.connected()) unavailable = spotify.blocked === "unlisted" ? "unlisted" : "offline";
      }
      if (!unavailable) {
        const listId = mix ? "set-" + theme + "-" + count : "";
        const ok = await liveStart(name, items, "spotify", true, null, listId, chakras);
        if (ok) return [{ ok: true, source: "session" }];
        unavailable = spotify.lastFailure || spotify.blocked || "failed";
      }
    }

    if (!unavailable && recordedAll(items)) {
      const ok = await liveStart(name, items, "recordings", true, null, "", chakras);
      return ok ? [{ ok: true, source: "session" }] : [{ ok: false, error: "The music did not start." }, 404];
    }

    if (!recordedAll(items)) {
      const disc = pickHostedDisc(count, albumId);
      picked = disc ? albumSit(count, disc.id) : null;
      if (!picked) {
        const offer = makeOffer({
          reason: unavailable || "offline",
          asked: askedDisc ? askedDisc.title : "",
          askedId: askedDisc ? askedDisc.id : "",
          theme, count, mode: "session",
        });
        return [{ ok: false, error: offer.text, offer }, 409];
      }
      items = picked.map((item) => ({ discId: item.discId, n: item.n }));
      chakras = picked.map((item) => item.chakra);
    }

    const ok = await liveStart(name, items, "recordings", true, null, "", chakras);
    const heard = describeItems(ok ? items : []);
    const offer = makeOffer({
      reason: unavailable || "offline",
      asked: askedDisc && !onRecordings(askedDisc) ? askedDisc.title : "",
      askedId: askedDisc && !onRecordings(askedDisc) ? askedDisc.id : "",
      playing: heard.playing,
      playingId: heard.playingId,
      mix: heard.mix,
      theme, count, mode: "session",
    });
    if (!ok) return [{ ok: false, error: offer.text, offer }, 409];
    return [{ ok: true, source: "session", offer }];
  }

  async function startForm(payload) {
    spotify.load();
    const tracks = payload.tracks || [];
    const error = playlistError(tracks);
    if (error) return [{ ok: false, error }, 400];
    const name = String(payload.name || "Form");
    const prefer = payload.prefer === "apple" ? "apple" : "spotify";
    const items = orderedDraft(tracks);
    if (recordedAll(items) || prefer === "apple") {
      const ok = await liveStart(name, items, prefer, true, null, payload.id || "");
      return ok ? [{ ok: true, source: "playlist" }] : [{ ok: false, error: "The music did not start." }, 404];
    }
    let unavailable = spotifyKnownUnavailable();
    if (!unavailable && spotify.connected()) {
      const who = await spotify.ensureListener();
      if (who === "unlisted" || who === "premium") unavailable = who;
      else if (!spotify.connected()) unavailable = spotify.blocked === "unlisted" ? "unlisted" : "offline";
    }
    if (!unavailable) {
      const ok = await liveStart(name, items, prefer, true, null, payload.id || "");
      if (ok) return [{ ok: true, source: "playlist" }];
      unavailable = spotify.lastFailure || "failed";
    }
    const count = 3;
    const disc = pickHostedDisc(count, "");
    const picked = disc ? albumSit(count, disc.id) : null;
    if (!picked) {
      const offer = makeOffer({ reason: unavailable || "offline", asked: name, count, mode: "session" });
      return [{ ok: false, error: offer.text, offer }, 409];
    }
    const hosted = picked.map((item) => ({ discId: item.discId, n: item.n }));
    const ok = await liveStart(name, hosted, "recordings", true, null, "", picked.map((item) => item.chakra));
    const heard = describeItems(ok ? hosted : []);
    const offer = makeOffer({
      reason: unavailable || "offline",
      asked: name,
      playing: heard.playing,
      playingId: heard.playingId,
      count, mode: "session",
    });
    if (!ok) return [{ ok: false, error: offer.text, offer }, 409];
    return [{ ok: true, source: "playlist", offer }];
  }

  async function startDisc(payload) {
    spotify.load();
    stopQueue();
    const disc = DISCS[payload.id];
    if (closedDisc(disc)) return [{ ok: false, error: "That disc is not on the shelf." }, 404];
    const albumItems = disc.tracks.filter((track) => itemPlayable({ discId: disc.id, n: track.n })).map((track) => ({ discId: disc.id, n: track.n }));
    if (!albumItems.length) {
      const offer = makeOffer({
        reason: spotifyKnownUnavailable() || "offline",
        asked: disc.title,
        askedId: disc.id,
        mode: "album",
        count: 0,
      });
      return [{ ok: false, error: offer.text, offer }, 409];
    }
    if (albumItems.every((item) => recordingOf(item.discId, item.n))) {
      const ok = await liveStart(disc.title, albumItems, "recordings", false, null);
      return ok ? [{ ok: true, source: "recordings" }] : [{ ok: false, error: "This album did not start." }, 404];
    }
    if (payload.source === "apple") {
      const options = { apple: appleId(disc) ? { album: appleId(disc) } : null };
      if (options.apple && await liveStart(disc.title, albumItems, "apple", false, options)) {
        return [{ ok: true, source: "apple" }];
      }
      const id = appleId(disc);
      if (!id) return [{ ok: false, error: "This disc is not on Apple Music." }, 403];
      openPlayer("https://music.apple.com/us/album/" + id);
      return [{ ok: true, source: "apple" }];
    }
    if (payload.source && payload.source !== "spotify") {
      return [{ ok: false, error: "Your own copies play in the desktop app." }, 403];
    }
    if (!disc.spotifyAlbum) return [{ ok: false, error: "Not on Spotify." }, 403];

    let unavailable = spotifyKnownUnavailable();
    if (!unavailable && spotify.connected()) {
      const who = await spotify.ensureListener();
      if (who === "unlisted" || who === "premium") unavailable = who;
      else if (!spotify.connected()) unavailable = spotify.blocked === "unlisted" ? "unlisted" : "offline";
    }
    if (!unavailable) {
      const options = { spotify: { context_uri: "spotify:album:" + disc.spotifyAlbum } };
      if (await liveStart(disc.title, albumItems, "spotify", false, options)) {
        return [{ ok: true, source: "spotify" }];
      }
      unavailable = spotify.lastFailure || "failed";
    }
    const hosted = collection.discs.filter(onRecordings);
    const pick = hosted.find((item) => item.id !== disc.id) || hosted[0];
    if (!payload.sit || !pick) {
      const offer = makeOffer({
        reason: unavailable || "offline",
        asked: disc.title,
        askedId: disc.id,
        playing: "",
        count: 0,
        mode: "album",
      });
      return [{ ok: false, error: offer.text, offer }, 409];
    }
    const items = pick.tracks.map((track) => ({ discId: pick.id, n: track.n }));
    const ok = await liveStart(pick.title, items, "recordings", false, null);
    const offer = makeOffer({
      reason: unavailable || "offline",
      asked: disc.title,
      askedId: disc.id,
      playing: ok ? pick.title : "",
      playingId: ok ? pick.id : "",
      count: 0,
      mode: "album",
    });
    if (!ok) return [{ ok: false, error: offer.text, offer }, 409];
    return [{ ok: true, source: "recordings", offer }];
  }

  function play(payload) {
    sitTheme = payload.source === "session" ? (payload.theme === "evening" ? "evening" : "morning") : "";
    if (payload.source === "session") return startSession(payload);
    if (payload.source === "playlist") return startForm(payload);
    return startDisc(payload);
  }

  /* Listening time for the on-device practice record. Theme is the morning or
     evening the listener chose; a shelf sit leaves it blank. */
  const Practice = window.YantraPractice || null;
  if (Practice) Practice.recover();
  const listening = Practice
    ? Practice.createListeningClock()
    : { begin() {}, active() { return false; }, observe() {}, snapshot() { return null; }, end() { return { ms: 0, theme: "", date: "" }; } };
  let sitTheme = "";

  noteListening = function (playing, item, position, key) {
    const id = key || (item ? item.discId + "#" + item.n : "");
    listening.observe({ key: id, position: Number(position) || 0, playing: !!playing, at: Date.now() });
  };

  function rememberSit() {
    if (Practice && listening.active()) Practice.checkpoint(listening.snapshot());
  }

  /* Keeps a phone's screen from sleeping while a sitting runs. */
  let screenLock = null;
  function holdScreen(on) {
    if (!on) {
      if (screenLock) screenLock.release().catch(() => {});
      screenLock = null;
      return;
    }
    if (screenLock || !navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then((lock) => {
      screenLock = lock;
      lock.addEventListener("release", () => { if (screenLock === lock) screenLock = null; });
    }).catch(() => {});
  }
  window.yantraHold = function () {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => {});
    holdScreen(true);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") rememberSit();
    if (document.visibilityState === "visible" && document.body && document.body.classList.contains("sitting")) holdScreen(true);
  });
  window.addEventListener("pagehide", rememberSit);
  setInterval(rememberSit, 15000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  function sit(on) {
    const root = document.documentElement;
    holdScreen(on);
    if (on) {
      listening.begin(sitTheme);
      if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => {});
    } else {
      if (Practice) Practice.commit(listening.end());
      sitTheme = "";
      liveStop(true);
      stopQueue();
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    return [{ ok: true, sitting: on }];
  }

  function route(path, method, init) {
    if (method === "GET") {
      if (path === "/audio") return [{ rms: sampleLevel() }];
      if (path === "/now") return [NOW];
      if (path === "/collection") return [collectionPayload()];
      if (path === "/playlists") return [{ playlists: publicForms() }];
      return null;
    }
    if (path === "/sit") return sit(!!readBody(init).on);
    if (path === "/play") return play(readBody(init));
    if (path === "/playlists") return editForms(readBody(init));
    if (path === "/install") return [{ ok: false, error: "Your own copies install in the desktop app." }, 403];
    return null;
  }

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("/push")) {
      const path = url.split("?")[0];
      if (path === "/access" || path === "/access/sangha" || path === "/leave" || path === "/logout") return realFetch(input, init);
      const method = String((init && init.method) || "GET").toUpperCase();
      // Opening a window must happen inside the click, so those requests are
      // answered right away. The rest wait for the shelf.
      const deliver = (answer) => Promise.resolve(answer).then((pair) => (
        pair ? reply(pair[0], pair[1]) : reply({ ok: false }, 404)
      ));
      if (method === "POST" && (path === "/sit" || (path === "/play" && collection))) {
        return deliver(route(path, method, init));
      }
      return session.then(() => deliver(route(path, method, init)));
    }
    return realFetch(input, init);
  };

  const style = document.createElement("style");
  style.textContent = [
    "#local, #install { display: none !important; }",
    "#web-next { position: fixed; left: 50%; bottom: 2.2rem; transform: translateX(-50%); z-index: 4;",
    "  background: rgba(5, 4, 10, 0.55); color: rgba(243, 230, 200, 0.8); font: inherit; font-size: 0.8rem;",
    "  border: 1px solid rgba(230, 201, 138, 0.35); padding: 0.55rem 1rem; letter-spacing: 0.08em; cursor: pointer; }",
    "#web-next.due { color: #f7edd4; border-color: rgba(230, 201, 138, 0.8); }",
    "body:not(.sitting) #web-next { display: none; }",
    "#web-resume { position: fixed; left: 50%; bottom: max(2.2rem, env(safe-area-inset-bottom)); transform: translateX(-50%);",
    "  z-index: 5; display: flex; gap: 1rem; align-items: center; padding: 0.7rem 1rem; max-width: 92vw;",
    "  background: rgba(5, 4, 10, 0.85); border: 1px solid rgba(230, 201, 138, 0.35); color: rgba(243, 230, 200, 0.85); }",
    "#web-resume[hidden] { display: none; }",
    "#web-resume button { background: transparent; color: #f7edd4; font: inherit; cursor: pointer; letter-spacing: 0.12em;",
    "  text-transform: uppercase; font-size: 0.8rem; border: 1px solid rgba(230, 201, 138, 0.7); padding: 0.55rem 0.9rem; }",
    "body.sitting #web-resume { display: none; }",
    "#music-offer { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6;",
    "  width: min(26rem, calc(100vw - 2rem)); max-height: min(72vh, 36rem); overflow: auto;",
    "  padding: 1.15rem 1.2rem 1rem; background: rgba(5, 4, 10, 0.94);",
    "  border: 1px solid rgba(230, 201, 138, 0.4); color: rgba(243, 230, 200, 0.9);",
    "  font-family: Palatino, 'Iowan Old Style', 'Times New Roman', serif; text-align: left; }",
    "#music-offer[hidden] { display: none; }",
    "#music-offer p { margin: 0 0 0.85rem; line-height: 1.5; font-size: 1.02rem; }",
    "#music-offer [data-connect], #music-offer [data-keep] { font: inherit; cursor: pointer;",
    "  background: transparent; color: #f7edd4; border: 1px solid rgba(230, 201, 138, 0.55); }",
    "#music-offer [data-connect] { display: block; width: 100%; padding: 0.75rem 0.6rem;",
    "  letter-spacing: 0.08em; margin-bottom: 0.95rem; }",
    "#music-offer [data-connect][hidden] { display: none; }",
    "#music-offer [data-kicker] { letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.72rem;",
    "  color: rgba(230, 201, 138, 0.75); margin: 0.15rem 0 0.35rem; }",
    "#music-offer .music-offer-circle { margin: 0.75rem 0 0.15rem; font-size: 0.75rem;",
    "  letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232, 204, 146, 0.5); }",
    "#music-offer [data-albums] button { display: block; width: 100%; text-align: left; font: inherit;",
    "  cursor: pointer; padding: 0.48rem 0.15rem; background: transparent; border: 0;",
    "  border-bottom: 1px solid rgba(230, 201, 138, 0.12); color: rgba(247, 237, 212, 0.92); }",
    "#music-offer [data-albums] button:disabled { color: rgba(232, 204, 146, 0.45); cursor: default; }",
    "#music-offer [data-keep] { display: block; margin: 0 auto 0.95rem; padding: 0.55rem 0.95rem;",
    "  letter-spacing: 0.1em; }",
    "#music-offer [data-keep][hidden] { display: none; }",
  ].join("\n");
  document.head.appendChild(style);
})();
