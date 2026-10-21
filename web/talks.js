/* Rama talks on the Your practice page, for the Zazen word only.
 *
 * The list is web/talks.json and the audio is /talks/<key> in the private R2
 * bucket. The Worker refuses both to the Sangha word, and this page also keeps
 * the section hidden unless the access level is zazen.
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
      let last = 0;
      player.addEventListener("timeupdate", () => {
        const at = player.currentTime;
        if (Math.abs(at - last) < 10) return;
        last = at;
        const here = player.getAttribute("src") || "";
        if (here) keepProgress(here, at, player.duration && at >= player.duration - 30);
      });
      player.addEventListener("pause", () => {
        const here = player.getAttribute("src") || "";
        if (here && player.currentTime > 0) keepProgress(here, player.currentTime, false);
      });
      player.addEventListener("ended", () => {
        const here = player.getAttribute("src") || "";
        if (here) keepProgress(here, 0, true);
      });
    }
    const started = player.play();
    if (started && typeof started.catch === "function") started.catch(() => {});
    if (root && typeof root.dispatchEvent === "function" && typeof CustomEvent === "function") {
      root.dispatchEvent(new CustomEvent("yantra:talk", { detail: { src: src, title: title, setTitle: setTitle || "" } }));
    }
  }

  /* Sets in their own order, each with its playable talks. Nothing unless zazen. */
  function talkSections(data, level) {
    if (level !== "zazen" || !data || !Array.isArray(data.sets)) return [];
    const out = [];
    for (const set of data.sets) {
      if (!set || !Array.isArray(set.talks)) continue;
      const talks = set.talks
        .map((talk) => ({ title: String(talk.title || ""), src: talkSrc(talk.key), length: formatLength(talk.seconds) }))
        .filter((talk) => talk.title && talk.src);
      if (talks.length) out.push({ id: String(set.id || ""), title: String(set.title || ""), talks });
    }
    return out;
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

  /* Fills the #talks-list section. Returns true when it is shown. */
  function render(section, data, level, doc) {
    if (!section) return false;
    const d = doc || section.ownerDocument;
    const sections = talkSections(data, level);
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
        if (entry && entry.done) button.classList.add("heard");
        button.append(name, length);
        button.addEventListener("click", () => {
          if (!player) return;
          start(player, talk.src, talk.title, set.title, now);
        });
        group.append(button);
      }
      if (list) list.append(group);
    }
    section.hidden = false;
    return true;
  }

  const api = { talkSrc, formatLength, stateLabel, talkSections, findTalk, play, render };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.YantraTalks = api;
})(typeof window !== "undefined" ? window : globalThis);
