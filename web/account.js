/* Settings for this device. The word gate is the only sign-in. */
(function () {
  function profile() {
    return window.YantraProfile || null;
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
  }

  function reminderLine() {
    try {
      const raw = JSON.parse(localStorage.getItem("yantra.reminders.v1") || "null") || {};
      const on = (theme) => raw[theme] && raw[theme].on;
      return "Morning " + (on("morning") ? "on" : "off") + " · Evening " + (on("evening") ? "on" : "off");
    } catch (e) {
      return "Morning off · Evening off";
    }
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
    const node = document.getElementById("account-practice");
    const practice = window.YantraPractice;
    if (!node || !practice) return;
    node.textContent = practice.lead(practice.summary());
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

  async function paintAccess() {
    const node = document.getElementById("account-access");
    if (!node) return;
    try {
      const response = await fetch("/access", { cache: "no-store" });
      if (!response.ok) throw new Error("closed");
      const data = await response.json();
      if (data.level === "zazen") node.textContent = "Sangha and Zazen. The full shelf is open.";
      else if (data.level === "sangha") node.textContent = "Sangha word. The Vayu recordings are open.";
      else node.textContent = "The word gate is not open in this copy.";
    } catch (e) {
      node.textContent = "The word gate is not open in this copy.";
    }
  }

  function paintAccount() {
    paintProfile();
    paintPractice();
    paintSpotify();
    paintAccess();
    const reminders = document.getElementById("account-reminders-status");
    if (reminders) reminders.textContent = reminderLine();
    paintGreeting();
  }

  function showConfirm(id, open) {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = !open;
  }

  async function signOut() {
    const response = await fetch("/leave", { method: "POST" });
    if (!response.ok) {
      const status = document.getElementById("account-access");
      if (status) status.textContent = "Sign out did not complete. The word gate is still open.";
      showConfirm("account-signout-confirm", false);
      return;
    }
    location.replace("/");
  }

  async function eraseEverything() {
    try {
      if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      }
    } catch (e) {}
    let id = "";
    try {
      const raw = JSON.parse(localStorage.getItem("yantra.reminders.v1") || "null");
      if (raw && raw.id) id = raw.id;
    } catch (e) {}
    if (id) {
      await fetch("/push/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id }),
      }).catch(() => {});
    }
    const api = profile();
    if (api) {
      api.clearYantra(localStorage);
      try { api.clearYantra(sessionStorage); } catch (e) {}
    }
    await fetch("/leave", { method: "POST" }).catch(() => {});
    location.replace("/");
  }

  function boot() {
    if (!window.YANTRA_WEB || !document.getElementById("account")) return;
    paintGreeting();
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
    document.getElementById("account-signout").addEventListener("click", () => showConfirm("account-signout-confirm", true));
    document.getElementById("account-signout-keep").addEventListener("click", () => showConfirm("account-signout-confirm", false));
    document.getElementById("account-signout-yes").addEventListener("click", () => {
      signOut().catch(() => {
        const status = document.getElementById("account-access");
        if (status) status.textContent = "Sign out did not complete. The word gate is still open.";
      });
    });
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
