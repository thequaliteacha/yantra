/* Dharma Talks on this site. web/talks.json is the list.
   A talk or a meditation plays from /talks/ in the R2 bucket.
   The key may include one folder, as in talks/rama-live-la/<id>.mp3.
   A quote is the text in the manifest. source is never turned into a link. */
(function (root) {
  const CREDIT = "from the Rama Meditation Society";
  const COLLECTIONS = ["Dharma Talks", "Rama Live LA"];
  const KINDS = ["talk", "meditation", "quote"];
  const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
  const KEY = /^talks\/(?:[a-z0-9][a-z0-9-]{0,40}\/)*([a-z0-9][a-z0-9-]{0,80})\.([a-z0-9]{1,8})$/;
  const HEADINGS = { talk: "Talks", meditation: "Meditations", quote: "Quotes" };

  function clean(value, max) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function entry(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const id = String(raw.id || "");
    if (!ID.test(id) || !KINDS.includes(raw.kind)) return null;
    const title = clean(raw.title, 180);
    if (!title) return null;
    const duration = Number(raw.duration);
    const size = Number(raw.size);
    if (!Number.isFinite(duration) || duration < 0 || duration > 8 * 3600) return null;
    if (!Number.isFinite(size) || size < 0 || size > 2 * 1024 * 1024 * 1024) return null;
    const collection = clean(raw.collection, 80);
    if (!collection || /https?:|\/\//i.test(collection)) return null;
    const text = typeof raw.text === "string" ? raw.text.trim().slice(0, 4000) : "";
    let r2Key = "";
    if (raw.r2Key) {
      const match = KEY.exec(String(raw.r2Key));
      if (!match || match[1] !== id) return null;
      r2Key = String(raw.r2Key);
    }
    if (raw.kind === "quote" && !text) return null;
    if (raw.kind !== "quote" && !r2Key) return null;
    return {
      id,
      title,
      description: clean(raw.description, 600),
      kind: raw.kind,
      collection,
      duration: Math.round(duration),
      size: Math.round(size),
      source: typeof raw.source === "string" ? raw.source.trim().slice(0, 300) : "",
      r2Key,
      text,
      example: raw.example === true,
      url: r2Key ? "/" + r2Key : "",
    };
  }

  function catalog(list) {
    const items = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const item = entry(raw);
      if (!item || seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    });
    return items;
  }

  function groups(items) {
    return KINDS.map((kind) => ({
      kind,
      heading: HEADINGS[kind],
      items: items.filter((item) => item.kind === kind),
    })).filter((group) => group.items.length);
  }

  /* Dharma Talks, then Rama Live LA, then any later collection in list order. */
  function collections(items) {
    const seen = [];
    items.forEach((item) => {
      if (!seen.includes(item.collection)) seen.push(item.collection);
    });
    const names = COLLECTIONS.filter((name) => seen.includes(name))
      .concat(seen.filter((name) => !COLLECTIONS.includes(name)));
    return names.map((name) => ({
      collection: name,
      groups: groups(items.filter((item) => item.collection === name)),
    }));
  }

  function slug(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
  }

  /* Fields the room is allowed to show. source stays off the screen. */
  function view(item) {
    return {
      title: item.title,
      description: item.description,
      text: item.kind === "quote" ? item.text : "",
      audio: item.kind === "quote" ? "" : item.url,
      example: item.example,
      credit: CREDIT,
    };
  }

  const api = { CREDIT, COLLECTIONS, KINDS, entry, catalog, groups, collections, view };
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  let current = null;
  let dragging = false;
  let focusName = "";

  async function loadItems() {
    try {
      const response = await fetch("talks.json", { cache: "no-store" });
      if (!response.ok) throw new Error("missing");
      return catalog(await response.json());
    } catch (e) {
      return [];
    }
  }

  function clock(seconds) {
    const whole = Math.max(0, Math.round(Number(seconds) || 0));
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
  }

  function audioEl() {
    return document.getElementById("talks-audio");
  }

  function publish(audio) {
    const play = document.getElementById("talks-play");
    if (play) play.textContent = audio.paused ? "Play" : "Pause";
    const clockNode = document.getElementById("talks-clock");
    const length = Number.isFinite(audio.duration) ? audio.duration : (current && current.duration) || 0;
    if (clockNode) clockNode.textContent = clock(audio.currentTime) + " / " + clock(length);
    const seek = document.getElementById("talks-seek");
    if (seek && !dragging && length > 0) seek.value = String(Math.round((audio.currentTime / length) * 1000));
    const session = navigator.mediaSession;
    if (!session) return;
    session.playbackState = audio.paused ? "paused" : "playing";
    if (!session.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      session.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(Math.max(audio.currentTime || 0, 0), audio.duration),
      });
    } catch (e) {}
  }

  function bindSession(item, audio) {
    const session = navigator.mediaSession;
    if (!session || typeof MediaMetadata === "undefined") return;
    const art = new URL("icons/apple-touch-icon.png", location.href).href;
    session.metadata = new MediaMetadata({
      title: item.title,
      artist: "Rama",
      album: item.collection || "Dharma Talks",
      artwork: [{ src: art, sizes: "180x180", type: "image/png" }],
    });
    const seekTo = (time) => {
      if (!Number.isFinite(time)) return;
      const length = Number.isFinite(audio.duration) ? audio.duration : time;
      audio.currentTime = Math.min(Math.max(time, 0), Math.max(length, 0));
      publish(audio);
    };
    const set = (name, fn) => {
      try { session.setActionHandler(name, fn); } catch (e) {}
    };
    set("play", () => { audio.play(); });
    set("pause", () => { audio.pause(); });
    set("seekbackward", (details) => seekTo(audio.currentTime - ((details && details.seekOffset) || 15)));
    set("seekforward", (details) => seekTo(audio.currentTime + ((details && details.seekOffset) || 15)));
    set("seekto", (details) => seekTo(details && details.seekTime));
    set("previoustrack", null);
    set("nexttrack", null);
  }

  function clearSession() {
    const session = navigator.mediaSession;
    if (!session) return;
    session.metadata = null;
    session.playbackState = "none";
  }

  function pauseTalk() {
    const audio = audioEl();
    if (audio && !audio.paused) audio.pause();
  }

  function rowFor(item) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "talk";
    const name = document.createElement("span");
    name.textContent = item.title;
    const meta = document.createElement("small");
    const bits = [];
    if (item.example) bits.push("Example");
    if (item.kind === "quote") bits.push("Text");
    else if (item.duration) bits.push(clock(item.duration));
    if (item.description) bits.push(item.description);
    meta.textContent = bits.join(" · ");
    button.append(name, meta);
    button.addEventListener("click", () => openItem(item));
    row.append(button);
    return row;
  }

  async function paint() {
    const list = document.getElementById("talks-list");
    if (!list) return;
    const items = await loadItems();
    const note = document.getElementById("talks-example");
    if (note) note.hidden = !(items.length && items.every((item) => item.example));
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "No talks are listed on this copy yet.";
      list.append(empty);
      return;
    }
    const wanted = focusName;
    focusName = "";
    collections(items).forEach((set) => {
      const block = document.createElement("section");
      block.id = "talks-collection-" + slug(set.collection);
      const heading = document.createElement("h3");
      heading.textContent = set.collection;
      block.append(heading);
      set.groups.forEach((group) => {
        const kind = document.createElement("h4");
        kind.textContent = group.heading;
        const ul = document.createElement("ul");
        group.items.forEach((item) => ul.append(rowFor(item)));
        block.append(kind, ul);
      });
      list.append(block);
    });
    if (wanted) {
      const node = document.getElementById("talks-collection-" + slug(wanted));
      if (node && node.scrollIntoView) node.scrollIntoView({ block: "start" });
    }
  }

  async function paintResources() {
    const host = document.getElementById("account-resources");
    if (!host) return;
    const items = await loadItems();
    host.replaceChildren();
    collections(items).forEach((set) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = set.collection;
      button.addEventListener("click", () => {
        focusName = set.collection;
        if (typeof window.showRoom === "function") window.showRoom("talks");
      });
      host.append(button);
    });
  }

  function openItem(item) {
    const shown = view(item);
    const quote = document.getElementById("talks-quote");
    const now = document.getElementById("talks-now");
    const audio = audioEl();
    current = item;
    document.querySelectorAll("audio").forEach((node) => {
      if (node !== audio && !node.paused) node.pause();
    });
    if (!shown.audio) {
      pauseTalk();
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      clearSession();
      if (now) now.hidden = true;
      if (quote) {
        quote.hidden = false;
        document.getElementById("talks-quote-title").textContent = shown.title;
        document.getElementById("talks-quote-text").textContent = shown.text;
      }
      return;
    }
    if (quote) quote.hidden = true;
    if (now) now.hidden = false;
    document.getElementById("talks-title").textContent = shown.title;
    document.getElementById("talks-description").textContent = shown.description;
    const status = document.getElementById("talks-status");
    if (status) status.textContent = item.example ? "Example data. The file plays once it is in the bucket." : "";
    const seek = document.getElementById("talks-seek");
    if (seek) seek.value = "0";
    if (!audio) return;
    bindSession(item, audio);
    audio.src = shown.audio;
    const pending = audio.play();
    if (pending) {
      pending.then(() => {
        if (status) status.textContent = "";
        publish(audio);
      }).catch(() => {
        if (status) status.textContent = "This recording is not on this copy yet.";
      });
    }
  }

  function boot() {
    const audio = audioEl();
    if (!audio) return;
    audio.addEventListener("timeupdate", () => publish(audio));
    audio.addEventListener("durationchange", () => publish(audio));
    audio.addEventListener("play", () => {
      if (current && current.kind !== "quote") bindSession(current, audio);
      publish(audio);
    });
    audio.addEventListener("pause", () => publish(audio));
    audio.addEventListener("ended", () => {
      if (navigator.mediaSession) navigator.mediaSession.playbackState = "none";
      publish(audio);
    });
    audio.addEventListener("error", () => {
      const status = document.getElementById("talks-status");
      if (status && audio.getAttribute("src")) status.textContent = "This recording is not on this copy yet.";
    });
    const play = document.getElementById("talks-play");
    if (play) {
      play.addEventListener("click", () => {
        if (!audio.getAttribute("src")) return;
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
      });
    }
    const seek = document.getElementById("talks-seek");
    if (seek) {
      seek.addEventListener("pointerdown", () => { dragging = true; });
      seek.addEventListener("pointerup", () => { dragging = false; });
      seek.addEventListener("change", () => { dragging = false; });
      seek.addEventListener("input", () => {
        const length = Number.isFinite(audio.duration) ? audio.duration : 0;
        if (length <= 0) return;
        audio.currentTime = (Number(seek.value) / 1000) * length;
      });
    }
  }

  if (root) {
    root.YantraTalks = api;
    root.paintTalkLibrary = paint;
    root.paintTalkResources = paintResources;
    root.yantraTalksPause = pauseTalk;
    if (typeof document !== "undefined") {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
      else boot();
    }
  }
})(typeof window !== "undefined" ? window : null);
