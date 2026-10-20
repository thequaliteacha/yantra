/* Settings for this device. The word gate is the only sign-in. */
(function () {
  function profile() {
    return window.YantraProfile || null;
  }

  function settings() {
    return window.YantraSettings || null;
  }

  function paintGreeting() {
    const api = profile();
    const text = api ? api.line(api.load(), new Date()) : "";
    ["home-greeting", "done-greeting"].forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.textContent = text;
      node.hidden = !text;
    });
    paintCorner();
  }

  function paintCorner() {
    const button = document.getElementById("account-corner");
    if (!button || !window.YANTRA_WEB) return;
    const api = profile();
    const name = api ? api.load().name : "";
    button.textContent = name ? name.slice(0, 1).toUpperCase() : "You";
    button.hidden = false;
  }

  function reminderRecord() {
    const api = settings();
    if (api) {
      const value = api.get("reminders");
      return value && typeof value === "object" ? value : {};
    }
    try {
      return JSON.parse(localStorage.getItem("yantra.reminders.v1") || "null") || {};
    } catch (e) {
      return {};
    }
  }

  function reminderLine() {
    const raw = reminderRecord();
    const on = (theme) => raw[theme] && raw[theme].on;
    return "Morning " + (on("morning") ? "on" : "off") + " · Evening " + (on("evening") ? "on" : "off");
  }

  function paintProfile() {
    const api = profile();
    const current = api ? api.load() : { name: "", greeting: "none" };
    const name = document.getElementById("account-name");
    const greeting = document.getElementById("account-greeting");
    if (name && document.activeElement !== name) name.value = current.name;
    if (greeting) greeting.value = current.greeting;
  }

  function paintPractice() {
    if (typeof window.paintPractice === "function") window.paintPractice();
  }

  function paintSpotify() {
    const line = document.getElementById("account-spotify");
    const note = document.getElementById("account-spotify-note");
    const connect = document.getElementById("account-spotify-connect");
    const disconnect = document.getElementById("account-spotify-disconnect");
    const clear = document.getElementById("account-spotify-clear");
    if (!line) return;
    const api = window.yantraSpotify;
    const status = api ? api.status() : { available: false, connected: false, name: "", unlisted: false };
    if (status.connected) {
      line.textContent = status.name ? "Connected as " + status.name + "." : "Connected.";
    } else if (status.available) {
      line.textContent = "Not connected.";
    } else {
      line.textContent = "Spotify is not set up on this copy.";
    }
    if (connect) connect.hidden = !(status.available && !status.connected);
    if (disconnect) disconnect.hidden = !status.connected;
    if (note) {
      note.hidden = !status.unlisted;
      note.textContent = status.unlisted
        ? "This device remembers that the last Spotify account was not on Yantra's listener list. Hosted albums still play."
        : "";
    }
    if (clear) clear.hidden = !status.unlisted;
  }

  function paintSync() {
    const card = document.getElementById("account-sync");
    const method = document.getElementById("account-sync-method");
    const signOut = document.getElementById("account-signout-block");
    const api = settings();
    const sync = api ? api.get("flags.accountSync") === true : false;
    const showSignOut = api ? api.get("flags.accountSignOut") === true : false;
    if (card) card.hidden = !sync;
    if (method && api) method.textContent = "Preferred later: " + api.get("account.preferredMethod") + ".";
    if (signOut) signOut.hidden = !showSignOut;
  }

  function paintTalks() {
    const list = document.getElementById("account-talks");
    const empty = document.getElementById("account-talks-empty");
    if (!list) return;
    const saved = settings() ? settings().get("talks.saved") : [];
    list.replaceChildren();
    saved.forEach((id) => {
      const row = document.createElement("li");
      row.textContent = id;
      list.append(row);
    });
    list.hidden = !saved.length;
    if (empty) empty.hidden = saved.length > 0;
  }

  async function paintAccess() {
    const node = document.getElementById("account-access");
    const zazen = document.getElementById("account-zazen");
    if (!node) return;
    let level = "";
    try {
      const response = await fetch("/access", { cache: "no-store" });
      if (!response.ok) throw new Error("closed");
      const data = await response.json();
      level = data.level === "zazen" || data.level === "sangha" ? data.level : "";
      if (level === "zazen") node.textContent = "Access level: Zazen. The full shelf is open.";
      else if (level === "sangha") node.textContent = "Access level: Sangha. The Vayu recordings are open.";
      else node.textContent = "The word gate is not open in this copy.";
    } catch (e) {
      node.textContent = "The word gate is not open in this copy.";
    }
    if (settings() && level) settings().set("access.level", level);
    if (zazen) {
      zazen.hidden = !level;
      zazen.setAttribute("aria-checked", String(level === "zazen"));
      zazen.textContent = level === "zazen" ? "Switch to Sangha" : "Switch to Zazen";
    }
  }

  function paintAccount() {
    paintSync();
    paintProfile();
    paintPractice();
    paintSpotify();
    paintAccess();
    paintTalks();
    const reminders = document.getElementById("account-reminders-status");
    if (reminders) reminders.textContent = reminderLine();
    paintResources();
    paintGreeting();
  }

  function paintResources() {
    const root = document.getElementById("account-resources");
    const groups = window.YantraResources && window.YantraResources.groups;
    if (!root || !groups || root.childElementCount) return;
    groups.forEach((group) => {
      const heading = document.createElement("h4");
      heading.textContent = group.heading;
      const list = document.createElement("ul");
      group.items.forEach((item) => {
        const row = document.createElement("li");
        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.label;
        const note = document.createElement("span");
        note.textContent = item.note;
        row.append(link, note);
        list.append(row);
      });
      root.append(heading, list);
    });
  }

  function showConfirm(id, open) {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = !open;
  }

  async function dropZazen() {
    const response = await fetch("/access/sangha", { method: "POST" });
    if (!response.ok) {
      const status = document.getElementById("account-access");
      if (status) status.textContent = "Zazen access stayed on. The word gate did not change.";
      return;
    }
    if (settings()) settings().set("access.level", "sangha");
    showConfirm("account-zazen-drop", false);
    await paintAccess();
  }

  async function forgetPush() {
    try {
      if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      }
    } catch (e) {}
    const id = reminderRecord().id || "";
    if (id) {
      await fetch("/push/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id }),
      }).catch(() => {});
    }
  }

  async function eraseEverything() {
    await forgetPush();
    const api = profile();
    if (api) {
      api.clearYantra(localStorage);
      try { api.clearYantra(sessionStorage); } catch (e) {}
    }
    await fetch("/logout", { method: "POST" }).catch(() => {});
    location.replace("/logout");
  }

  function exportBundle() {
    const practice = window.YantraPractice ? window.YantraPractice.exportData() : {};
    const stored = settings() ? settings().entries() : {};
    return Object.assign({}, practice, { settings: stored });
  }

  function boot() {
    if (!window.YANTRA_WEB || !document.getElementById("account")) return;
    paintGreeting();
    const corner = document.getElementById("account-corner");
    if (corner) {
      corner.addEventListener("click", () => {
        if (typeof window.showRoom === "function") window.showRoom("account");
      });
    }
    document.getElementById("account-save").addEventListener("click", () => {
      const api = profile();
      if (!api) return;
      api.save({
        name: document.getElementById("account-name").value,
        greeting: document.getElementById("account-greeting").value,
      });
      const note = document.getElementById("account-saved");
      if (note) note.textContent = "Saved on this device.";
      paintGreeting();
    });
    const zazen = document.getElementById("account-zazen");
    if (zazen) {
      zazen.addEventListener("click", () => {
        if (zazen.getAttribute("aria-checked") === "true") showConfirm("account-zazen-drop", true);
        else showConfirm("account-zazen-ask", true);
      });
    }
    document.getElementById("account-zazen-cancel").addEventListener("click", () => showConfirm("account-zazen-ask", false));
    document.getElementById("account-zazen-drop-keep").addEventListener("click", () => showConfirm("account-zazen-drop", false));
    document.getElementById("account-zazen-drop-yes").addEventListener("click", () => {
      dropZazen().catch(() => {
        const status = document.getElementById("account-access");
        if (status) status.textContent = "Zazen access stayed on. The word gate did not change.";
      });
    });
    const openPractice = document.getElementById("account-practice-open");
    if (openPractice) {
      openPractice.addEventListener("click", () => {
        const practice = document.getElementById("practice");
        if (practice) practice.dataset.from = "account";
        if (typeof window.showRoom === "function") window.showRoom("practice");
      });
    }
    document.getElementById("account-leave").addEventListener("click", () => showConfirm("account-leave-confirm", true));
    document.getElementById("account-leave-keep").addEventListener("click", () => showConfirm("account-leave-confirm", false));
    document.getElementById("account-spotify-connect").addEventListener("click", () => {
      if (window.yantraSpotify) window.yantraSpotify.connect();
    });
    document.getElementById("account-spotify-disconnect").addEventListener("click", () => {
      if (window.yantraSpotify) window.yantraSpotify.disconnect();
      paintSpotify();
    });
    document.getElementById("account-spotify-clear").addEventListener("click", () => {
      if (window.yantraSpotify) window.yantraSpotify.clearUnlisted();
      paintSpotify();
    });
    document.getElementById("account-export").addEventListener("click", () => {
      const button = document.getElementById("practice-export");
      if (button) button.click();
    });
    document.getElementById("account-erase").addEventListener("click", () => {
      const practice = document.getElementById("practice");
      if (practice) practice.dataset.from = "account";
      if (typeof window.showRoom === "function") window.showRoom("practice");
      const button = document.getElementById("practice-erase");
      if (button) button.click();
    });
    document.getElementById("account-reminders").addEventListener("click", () => {
      const practice = document.getElementById("practice");
      if (practice) practice.dataset.from = "account";
      if (typeof window.showRoom === "function") window.showRoom("practice");
      const reminders = document.getElementById("reminders");
      if (reminders && reminders.scrollIntoView) reminders.scrollIntoView({ block: "start" });
    });
    document.getElementById("account-wipe").addEventListener("click", () => showConfirm("account-wipe-confirm", true));
    document.getElementById("account-wipe-keep").addEventListener("click", () => showConfirm("account-wipe-confirm", false));
    document.getElementById("account-wipe-yes").addEventListener("click", () => {
      eraseEverything().catch(() => {});
    });
  }

  window.paintGreeting = paintGreeting;
  window.paintAccount = paintAccount;
  window.yantraExportBundle = exportBundle;
  window.yantraForgetPush = forgetPush;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
