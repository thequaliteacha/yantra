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
    if (player.getAttribute("src") !== src) player.setAttribute("src", src);
    player.hidden = false;
    const now = section.querySelector("[data-talk-now]");
    if (now) now.textContent = title || "";
    const started = player.play();
    if (started && typeof started.catch === "function") started.catch(() => {});
    return true;
  }

  /* Fills the #practice-talks section. Returns true when it is shown. */
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
        length.textContent = talk.length;
        button.append(name, length);
        button.addEventListener("click", () => {
          if (!player) return;
          if (player.getAttribute("src") !== talk.src) player.setAttribute("src", talk.src);
          player.hidden = false;
          if (now) now.textContent = set.title + " \u00b7 " + talk.title;
          const started = player.play();
          if (started && typeof started.catch === "function") started.catch(() => {});
        });
        group.append(button);
      }
      if (list) list.append(group);
    }
    section.hidden = false;
    return true;
  }

  const api = { talkSrc, formatLength, talkSections, findTalk, play, render };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.YantraTalks = api;
})(typeof window !== "undefined" ? window : globalThis);
