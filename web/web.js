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
  ]).then(([discs, songs, settings, sessionSets, files]) => {
    sets = sessionSets;
    recordings = files || {};
    Object.assign(config, settings || {});
    collection = discs;
    links = songs || {};
    for (const disc of discs.discs) DISCS[disc.id] = disc;
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

  /* On the web only recorded or catalog albums can play. Discs on none of them
     stay hidden, as they do on the desktop until a track is installed. */
  const playable = (disc) => onRecordings(disc) || !!disc.spotifyAlbum || !!appleId(disc);

  function trackRef(discId, number) {
    const disc = DISCS[discId];
    const track = disc.tracks.find((item) => item.n === number);
    const onSpotify = !!disc.spotifyAlbum;
    const onApple = !!appleId(disc);
    return {
      discId, n: number, title: track.title, disc: disc.title, artist: disc.artist,
      chakra: chakraOf(disc, number), onSpotify, onApple, installed: false,
      playable: onSpotify || onApple,
    };
  }

  function collectionPayload() {
    const payload = Object.assign({}, collection);
    payload.discs = collection.discs.filter(playable).map((disc) => Object.assign({}, disc, {
      tracks: disc.tracks.map((track) => Object.assign({}, track, { chakra: chakraOf(disc, track.n), installed: false })),
      onSpotify: !!disc.spotifyAlbum,
      onApple: !!appleId(disc),
      onRecordings: onRecordings(disc),
      installed: 0,
      installDir: "",
    }));
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
    for (const disc of collection.discs.filter(playable)) {
      for (const track of disc.tracks) {
        if (chakraOf(disc, track.n) === chakra) pool.push([disc.id, track.n]);
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
    if (!isIn && !playable(disc)) return [null, "That song is not on Spotify or Apple Music."];
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
    formPlan: [], chakra: "",
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

  const spotify = {
    token: null,
    deviceId: "",
    player: null,
    sdk: false,
    sdkFailed: false,
    elsewhere: "",
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
        access: data.access_token,
        refresh: data.refresh_token || (this.token && this.token.refresh),
        expires: Date.now() + (data.expires_in - 60) * 1000,
      };
      this.save();
      return true;
    },
    /* Who is listening. A Spotify account missing from the app's User Management
       list is refused here, so the page can say so plainly. */
    async identify() {
      const response = await this.api("GET", "/me");
      if (!response) return "";
      if (!response.ok) {
        if (response.status === 403) {
          this.token = null;
          this.save();
          return "unlisted";
        }
        return "";
      }
      const me = await response.json().catch(() => ({}));
      if (me.id) {
        this.token.user = me.id;
        this.save();
      }
      return "";
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
    async play(body) {
      this.elsewhere = "";
      // A tap soon after the page opens can come before the in-page player is ready.
      for (let waited = 0; this.sdk && !this.deviceId && !this.sdkFailed && waited < 5000; waited += 250) {
        await new Promise((resolve) => setTimeout(resolve, 250));
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
      if (!response || !(response.ok || response.status === 204)) return false;
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
    available() { return Object.keys(recordings).length > 0; },
    connected() { return this.available(); },
    element() {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.addEventListener("ended", () => {
          if (this.index + 1 < this.keys.length) this.start(this.index + 1);
        });
      }
      return this.audio;
    },
    start(index) {
      const audio = this.element();
      this.index = index;
      audio.src = this.keys[index];
      studyRecording(this.keys[index]);
      return audio.play().then(() => true, () => false);
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
  const live = { service: null, name: "", items: [], keys: [], seen: false, timer: 0, form: false, chakras: null, lastHeard: false };

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
    if (!playable(disc)) return false;
    const per = count === 1 ? 0 : count / 3;
    const sizes = CHAKRAS.map((chakra) => disc.tracks.filter((track) => chakraOf(disc, track.n) === chakra).length);
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
      const songs = disc.tracks.filter((track) => chakraOf(disc, track.n) === chakra);
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
    Object.assign(NOW, {
      connected: true,
      status: state.playing ? "Playing" : (last && state.position < 1 ? "Stopped" : "Paused"),
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

  /* Not connected yet: remember the sit, connect once, then offer it on return. */
  function connectFirst(pending) {
    try { sessionStorage.setItem("yantra.pending", JSON.stringify(pending)); } catch (e) {}
    spotify.connect();
    return [{ ok: false, error: "Connecting to Spotify. You will come right back here." }, 409];
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

  /* Starts the list in the page. Returns false when no connected service can play all of it. */
  function liveStart(name, items, prefer, form, albumOptions, formId, chakras) {
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
      started = recorded.play(live.keys);
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
    started.then((ok) => {
      if (ok && service === "spotify" && spotify.elsewhere && nextButton) {
        // Say where the music went, so a quiet page never leaves the listener guessing.
        nextButton.hidden = false;
        nextButton.classList.remove("due");
        nextButton.textContent = "Playing on " + spotify.elsewhere;
        nextButton.onclick = () => { nextButton.hidden = true; nextButton.onclick = null; };
        setTimeout(() => { if (nextButton.textContent.startsWith("Playing on ")) nextButton.click(); }, 8000);
      }
      if (ok || live.service !== service) return;
      liveStop(false);
      offerTab(items, prefer, name, form);
    });
    live.timer = setInterval(livePoll, 1000);
    return true;
  }

  /* When in-page play fails after the tap, a tap is needed again to open the service. */
  function offerTab(items, prefer, name, form) {
    queue.name = name;
    queue.items = items;
    queue.prefer = prefer;
    queue.index = -1;
    if (!nextButton) return;
    nextButton.hidden = false;
    nextButton.classList.add("due");
    nextButton.textContent = "The music did not start here  ·  Tap to open it";
    nextButton.onclick = () => {
      nextButton.onclick = null;
      playSong(0);
    };
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

  let notice = "";
  const session = ready.then(async () => {
    spotify.load();
    const query = new URLSearchParams(location.search);
    if (query.get("code") && spotify.available()) {
      await spotify.finish(query.get("code"), query.get("state"));
      history.replaceState(null, "", returnTo());
    } else if (query.get("error")) {
      history.replaceState(null, "", returnTo());
    }
    if (spotify.connected() && !spotify.token.user) {
      if ((await spotify.identify()) === "unlisted") {
        notice = "This Spotify account is not on Yantra's listener list yet. Ask whoever shared Yantra with you to add it.";
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
    spotify.startSdk();
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
  });

  function play(payload) {
    sitTheme = payload.source === "session" ? (payload.theme === "evening" ? "evening" : "morning") : "";
    if (payload.source === "session") {
      const theme = payload.theme === "evening" ? "evening" : "morning";
      const count = Number(payload.count) || 3;
      // Mix It Up draws on the curated sets, across albums; otherwise the sit keeps to one album.
      const mix = !!payload.mix;
      const picked = mix ? sessionItems(theme, count) : albumSit(count, String(payload.album || ""));
      if (!picked) {
        const disc = DISCS[payload.album];
        return [{ ok: false, error: disc && !mix ? disc.title + " is too short for " + count + " songs." : "That sit is not available." }, 404];
      }
      const name = String(payload.name || theme);
      const items = picked.map((item) => ({ discId: item.discId, n: item.n }));
      if (!recordedAll(items) && spotify.available() && !spotify.connected()) {
        return connectFirst({ kind: "session", theme, count, name, mix, album: mix ? "" : items[0].discId });
      }
      const listId = mix ? "set-" + theme + "-" + count : "";
      if (liveStart(name, items, "spotify", true, null, listId, picked.map((item) => item.chakra))) {
        return [{ ok: true, source: "session" }];
      }
      queue.name = name;
      queue.items = items;
      queue.prefer = "spotify";
      if (!playSong(0)) {
        stopQueue();
        return [{ ok: false, error: "The first song did not open." }, 404];
      }
      return [{ ok: true, source: "session" }];
    }
    if (payload.source === "playlist") {
      const tracks = payload.tracks || [];
      const error = playlistError(tracks);
      if (error) return [{ ok: false, error }, 400];
      const name = String(payload.name || "Form");
      const prefer = payload.prefer === "apple" ? "apple" : "spotify";
      if (!recordedAll(orderedDraft(tracks)) && prefer === "spotify" && spotify.available() && !spotify.connected()) {
        return connectFirst({ kind: "form", name, id: payload.id || "", tracks });
      }
      if (liveStart(name, orderedDraft(tracks), prefer, true, null, payload.id || "")) return [{ ok: true, source: "playlist" }];
      queue.name = name;
      queue.items = orderedDraft(tracks);
      queue.prefer = prefer;
      if (!playSong(0)) {
        stopQueue();
        return [{ ok: false, error: "The first song did not open." }, 404];
      }
      return [{ ok: true, source: "playlist" }];
    }
    stopQueue();
    const disc = DISCS[payload.id];
    if (!disc) return [{ ok: false, error: "That disc is not on the shelf." }, 404];
    const albumItems = disc.tracks.map((track) => ({ discId: disc.id, n: track.n }));
    if (recordedAll(albumItems) && liveStart(disc.title, albumItems, payload.source, false, null)) {
      return [{ ok: true, source: "recordings" }];
    }
    if (payload.source === "spotify" && spotify.available() && !spotify.connected()) {
      return connectFirst({ kind: "album", name: disc.title, id: disc.id });
    }
    if (payload.source === "spotify" || payload.source === "apple") {
      const items = disc.tracks.map((track) => ({ discId: disc.id, n: track.n }));
      const options = {
        spotify: disc.spotifyAlbum ? { context_uri: "spotify:album:" + disc.spotifyAlbum } : null,
        apple: appleId(disc) ? { album: appleId(disc) } : null,
      };
      if (options[payload.source] && liveStart(disc.title, items, payload.source, false, options)) {
        return [{ ok: true, source: payload.source }];
      }
    }
    liveStop(true);
    if (payload.source === "apple") {
      const id = appleId(disc);
      if (!id) return [{ ok: false, error: "This disc is not on Apple Music." }, 403];
      openPlayer("https://music.apple.com/us/album/" + id);
      return [{ ok: true, source: "apple" }];
    }
    if (payload.source === "spotify" || !payload.source) {
      if (!disc.spotifyAlbum) return [{ ok: false, error: "Not on Spotify." }, 403];
      openPlayer("https://open.spotify.com/album/" + encodeURIComponent(disc.spotifyAlbum));
      return [{ ok: true, source: "spotify" }];
    }
    return [{ ok: false, error: "Your own copies play in the desktop app." }, 403];
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
    if (typeof url === "string" && url.startsWith("/")) {
      const path = url.split("?")[0];
      const method = String((init && init.method) || "GET").toUpperCase();
      // Opening a window must happen inside the click, so those requests are
      // answered right away. The rest wait for the shelf.
      if (method === "POST" && (path === "/sit" || (path === "/play" && collection))) {
        const answer = route(path, method, init);
        return Promise.resolve(reply(answer[0], answer[1]));
      }
      return session.then(() => {
        const answer = route(path, method, init);
        return answer ? reply(answer[0], answer[1]) : reply({ ok: false }, 404);
      });
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
  ].join("\n");
  document.head.appendChild(style);
})();
