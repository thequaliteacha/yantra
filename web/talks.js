/* Rama talks on the Your practice page, for the Zazen word only.
 *
 * The list is web/talks.json and the audio is /talks/<key> in the private R2
 * bucket. The Worker refuses both to the Sangha word, and this page also keeps
 * the section hidden unless the access level is zazen.
 * A talk can be kept on this device. Offline, a talk that was not kept is
 * left off the list. Streaming stays when the talk is not kept and the
 * network is here.
 */
(function (root) {
  const KEY = /^talks\/[a-z0-9][a-z0-9./_-]{0,160}\.mp3$/;

  function talkSrc(key) {
    const text = String(key || "");
    if (!KEY.test(text) || text.includes("..")) return "";
    return "/" + text;
  }

  function formatLength(seconds) {
    const total = Math.round(Number(seconds) || 0);
    if (total <= 0) return "";
    const minutes = Math.round(total / 60);
    if (minutes < 60) return minutes + " min";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours + " hr" + (rest ? " " + rest + " min" : "");
  }

  /* Where a talk was left, kept with the other settings on this device. */
  function progressAll() {
    const S = root && root.YantraSettings;
    return S ? S.get("talks.progress") || {} : {};
  }

  function keepProgress(src, at, done) {
    const S = root && root.YantraSettings;
    if (!S) return;
    const all = progressAll();
    all[src] = { at: done ? 0 : Math.max(0, Math.round(at)), done: !!done || !!(all[src] && all[src].done) };
    S.set("talks.progress", all);
  }

  /* The right-hand note on a talk: its length, how far in, or a mark once heard. */
  function stateLabel(length, seconds, entry) {
    if (entry && entry.done) return "\u2713 " + length;
    if (entry && entry.at >= 60) return formatLength(entry.at) + " of " + length;
    return length;
  }

  /* Lock-screen title and play/pause/skip for a talk. */
  function lockScreen(player, title, setTitle) {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (!nav || !nav.mediaSession || typeof MediaMetadata === "undefined") return;
    nav.mediaSession.metadata = new MediaMetadata({ title: title, artist: "Rama", album: setTitle || "Dharma Talks" });
    const skip = (by) => () => { player.currentTime = Math.max(0, player.currentTime + by); };
    try {
      nav.mediaSession.setActionHandler("play", () => player.play());
      nav.mediaSession.setActionHandler("pause", () => player.pause());
      nav.mediaSession.setActionHandler("seekbackward", skip(-15));
      nav.mediaSession.setActionHandler("seekforward", skip(30));
    } catch (e) {}
  }

  const keeping = typeof WeakSet === "function" ? new WeakSet() : null;

  /* Starts a talk where it was left, and keeps its place as it plays. */
  function start(player, src, title, setTitle, now) {
    if (player.getAttribute("src") !== src) {
      player.setAttribute("src", src);
      const entry = progressAll()[src];
      if (entry && !entry.done && entry.at > 0 && typeof player.addEventListener === "function") {
        player.addEventListener("loadedmetadata", function resume() {
          player.removeEventListener("loadedmetadata", resume);
          if (!player.duration || entry.at < player.duration - 15) player.currentTime = entry.at;
        });
      }
    }
    player.hidden = false;
    if (now) now.textContent = (setTitle ? setTitle + " \u00b7 " : "") + title;
    lockScreen(player, title, setTitle);
    if (keeping && !keeping.has(player) && typeof player.addEventListener === "function") {
      keeping.add(player);
      let place = 0;
      const listening = () => root && root.YantraListening;
      /* The clock reads this element on its own timer, so a talk keeps
         accumulating after the visualizer closes and the talks page is hidden. */
      if (listening() && typeof listening().watchTalk === "function") {
        listening().watchTalk(() => {
          const here = player.getAttribute("src") || "";
          if (!here) return null;
          const at = Number(player.currentTime) || 0;
          const playing = !player.paused && !player.ended;
          if (playing && Math.abs(at - place) >= 10) {
            place = at;
            keepProgress(here, at, player.duration && at >= player.duration - 30);
          }
          return { key: here, position: at, playing: playing };
        });
      }
      const noteTalk = () => {
        const Listening = listening();
        const here = player.getAttribute("src") || "";
        if (!Listening || !here || typeof Listening.observeTalk !== "function") return;
        Listening.observeTalk({
          key: here,
          position: player.currentTime || 0,
          playing: !player.paused && !player.ended,
          at: Date.now(),
        });
      };
      const finishTalk = () => {
        noteTalk();
        const Listening = listening();
        if (Listening && typeof Listening.endTalk === "function") Listening.endTalk();
      };
      const pulse = () => {
        const Listening = listening();
        if (Listening && typeof Listening.pulseTalk === "function") Listening.pulseTalk();
      };
      player.addEventListener("timeupdate", () => {
        noteTalk();
        const at = player.currentTime;
        if (Math.abs(at - place) < 10) return;
        place = at;
        const here = player.getAttribute("src") || "";
        if (here) keepProgress(here, at, player.duration && at >= player.duration - 30);
      });
      player.addEventListener("play", pulse);
      player.addEventListener("seeked", () => {
        const here = player.getAttribute("src") || "";
        const at = Number(player.currentTime) || 0;
        if (here && at > 0) {
          place = at;
          keepProgress(here, at, false);
        }
        pulse();
      });
      player.addEventListener("pause", () => {
        const here = player.getAttribute("src") || "";
        if (here && player.currentTime > 0) keepProgress(here, player.currentTime, false);
        finishTalk();
      });
      player.addEventListener("ended", () => {
        const here = player.getAttribute("src") || "";
        if (here) keepProgress(here, 0, true);
        finishTalk();
      });
    }
    const started = player.play();
    if (started && typeof started.catch === "function") started.catch(() => {});
    if (root && typeof root.dispatchEvent === "function" && typeof CustomEvent === "function") {
      root.dispatchEvent(new CustomEvent("yantra:talk", { detail: { src: src, title: title, setTitle: setTitle || "" } }));
    }
  }

  function talkKept(src, kept) {
    if (!kept || !src) return false;
    if (typeof kept.has === "function") return kept.has(src);
    if (Array.isArray(kept)) return kept.indexOf(src) >= 0;
    return !!(kept[src] && kept[src].complete !== false);
  }

  /* A kept talk plays with the network off. Anything else still streams while online. */
  function canPlay(src, options) {
    const text = String(src || "");
    if (!KEY.test(text.replace(/^\//, "")) || text.includes("..") || !text.startsWith("/talks/")) return false;
    const opts = options || {};
    if (!opts.offline) return true;
    return talkKept(text, opts.kept);
  }

  /* Sets in their own order, each with its playable talks. Nothing unless zazen.
     Offline, a talk that is not on this device is omitted, not dimmed. */
  function talkSections(data, level, options) {
    if (level !== "zazen" || !data || !Array.isArray(data.sets)) return [];
    const opts = options || {};
    const out = [];
    for (const set of data.sets) {
      if (!set || !Array.isArray(set.talks)) continue;
      let talks = set.talks
        .map((talk) => ({ title: String(talk.title || ""), src: talkSrc(talk.key), length: formatLength(talk.seconds) }))
        .filter((talk) => talk.title && talk.src);
      if (opts.offline) talks = talks.filter((talk) => talkKept(talk.src, opts.kept));
      if (talks.length) out.push({ id: String(set.id || ""), title: String(set.title || ""), talks });
    }
    return out;
  }

  function talkInfo(src, options) {
    const opts = options || {};
    const state = (opts.states && opts.states[src]) || {};
    const kept = talkKept(src, opts.kept) || !!state.complete;
    return {
      complete: !!state.busy ? false : kept,
      bytes: Number(state.bytes) || 0,
      total: Number(state.total) || 0,
      busy: !!state.busy,
      error: !!state.error && !kept,
    };
  }

  function viewKey(data, level, options) {
    const opts = options || {};
    const bits = [String(level || ""), opts.offline ? "0" : "1"];
    talkSections(data, level, opts).forEach((set) => {
      bits.push(set.id);
      set.talks.forEach((talk) => {
        const info = talkInfo(talk.src, opts);
        bits.push(talk.src, info.busy ? "b" : "", info.complete ? "c" : "", info.error ? "e" : "", String(info.bytes), String(info.total));
      });
    });
    return bits.join("\u001f");
  }

  /* The talk whose title is the quote's source, from the list this level can see. */
  function findTalk(data, level, title) {
    const wanted = String(title || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!wanted) return null;
    for (const set of talkSections(data, level)) {
      for (const talk of set.talks) {
        if (talk.title.replace(/\s+/g, " ").trim().toLowerCase() === wanted) {
          return { title: talk.title, src: talk.src, setTitle: set.title };
        }
      }
    }
    return null;
  }

  /* Plays a talk that is already in the rendered list. */
  function play(section, src, title) {
    if (!section || typeof src !== "string" || !src.startsWith("/talks/") || src.includes("..")) return false;
    const player = section.querySelector("audio");
    if (!player) return false;
    start(player, src, title || "", "", section.querySelector("[data-talk-now]"));
    return true;
  }

  function keepView(info, offline) {
    const Offline = root && root.YantraOffline;
    if (Offline && typeof Offline.talkView === "function") return Offline.talkView(info, offline);
    if (info.busy) return { action: "Stop", secondary: "", detail: "Keeping", meter: null };
    if (info.complete) return { action: "Remove", secondary: "", detail: "On this device", meter: null };
    if (offline) return { action: "", secondary: "", detail: "", meter: null };
    if (info.error) return { action: "Try again", secondary: "", detail: "Could not finish. Try again on the network.", meter: null };
    return { action: "Keep offline", secondary: "", detail: "", meter: null };
  }

  function appendKeep(parent, d, talk, view, onAction) {
    if (!view || (!view.action && !view.detail && view.meter == null)) return;
    const row = d.createElement("div");
    row.className = "talk-keep";
    if (view.detail) {
      const detail = d.createElement("span");
      detail.className = "talk-keep-detail";
      detail.textContent = view.detail;
      row.append(detail);
    }
    if (view.meter != null) {
      const meter = d.createElement("span");
      meter.className = "talk-keep-meter";
      meter.setAttribute("role", "progressbar");
      meter.setAttribute("aria-valuenow", String(view.meter));
      meter.setAttribute("aria-valuemin", "0");
      meter.setAttribute("aria-valuemax", "100");
      const bar = d.createElement("span");
      if (bar.style) bar.style.width = view.meter + "%";
      meter.append(bar);
      row.append(meter);
    }
    const press = (label) => {
      const button = d.createElement("button");
      button.type = "button";
      button.className = "quiet";
      button.textContent = label;
      button.addEventListener("click", (event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        onAction(talk.src, label);
      });
      row.append(button);
    };
    if (view.action) press(view.action);
    if (view.secondary) press(view.secondary);
    parent.append(row);
  }

  /* Fills the #talks-list section. Returns true when it is shown. */
  function render(section, data, level, doc, options) {
    if (!section) return false;
    const d = doc || section.ownerDocument;
    const opts = options || {};
    const sections = talkSections(data, level, opts);
    const showKeep = level === "zazen" && typeof opts.onAction === "function";
    const list = section.querySelector("[data-talk-list]");
    const player = section.querySelector("audio");
    if (list) list.replaceChildren();
    if (!sections.length) {
      if (player) {
        player.pause();
        player.removeAttribute("src");
      }
      section.hidden = true;
      return false;
    }
    const now = section.querySelector("[data-talk-now]");
    // The heading and note come with talks.json, so the shared page names no one.
    const head = section.querySelector("[data-talk-head]");
    const note = section.querySelector("[data-talk-note]");
    if (head) head.textContent = String(data.heading || "Talks");
    if (note) note.textContent = String(data.note || "");
    for (const set of sections) {
      const group = d.createElement("div");
      group.className = "talk-set";
      const head = d.createElement("h4");
      head.textContent = set.title;
      group.append(head);
      for (const talk of set.talks) {
        const button = d.createElement("button");
        button.type = "button";
        button.className = "talk";
        const name = d.createElement("span");
        name.textContent = talk.title;
        const length = d.createElement("span");
        const entry = progressAll()[talk.src];
        length.textContent = stateLabel(talk.length, 0, entry);
        const heard = d.createElement("span");
        heard.className = "talk-heard";
        const Listening = root && root.YantraListening;
        const heardLine = Listening && typeof Listening.talkLine === "function" ? Listening.talkLine(talk.src) : "";
        heard.textContent = heardLine || "";
        heard.hidden = !heardLine;
        if (entry && entry.done) button.classList.add("heard");
        button.setAttribute("data-src", talk.src);
        button.append(name, length, heard);
        button.addEventListener("click", () => {
          if (!player) return;
          start(player, talk.src, talk.title, set.title, now);
        });
        if (!showKeep) {
          group.append(button);
          continue;
        }
        const wrap = d.createElement("div");
        wrap.className = "talk-row";
        wrap.append(button);
        appendKeep(wrap, d, talk, keepView(talkInfo(talk.src, opts), !!opts.offline), opts.onAction);
        group.append(wrap);
      }
      if (list) list.append(group);
    }
    section.hidden = false;
    return true;
  }

  const api = { talkSrc, formatLength, stateLabel, talkSections, canPlay, viewKey, findTalk, play, render };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.YantraTalks = api;
})(typeof window !== "undefined" ? window : globalThis);
