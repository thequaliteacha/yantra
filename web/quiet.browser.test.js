/* node web/quiet.browser.test.js
 *
 * Opens the real web edition in Chrome and exercises the quiet streak,
 * the practice calendar, and the Dharma invitation. Screenshots land in
 * /opt/cursor/artifacts.
 */
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ART = "/opt/cursor/artifacts";
const PORT = 8766;
const DEBUG = 9333;

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webmanifest")) return "application/manifest+json";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.normalize(path.join(ROOT, pathname));
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("missing");
          return;
        }
        res.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" });
        res.end(data);
      });
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await fetch("http://127.0.0.1:" + DEBUG + "/json/list").then((r) => r.json());
      const page = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) {}
    await sleep(100);
  }
  throw new Error("Chrome did not open a debugging port");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let seq = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("devtools socket failed")));
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method) events.push(msg);
    if (msg.id && pending.has(msg.id)) {
      const item = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) item.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else item.resolve(msg.result);
    }
  });
  function send(method, params) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  return { ready, send, events, close: () => ws.close() };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
    throw new Error(result.exceptionDetails.text + (detail ? "\n" + detail : ""));
  }
  return result.result ? result.result.value : undefined;
}

async function waitFor(send, expression, label) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < 20000) {
    last = await evaluate(send, "(() => { try { return (" + expression + "); } catch (e) { return 'ERR ' + e.message; } })()");
    if (last && last !== false && !(typeof last === "string" && last.startsWith("ERR"))) return last;
    await sleep(200);
  }
  throw new Error("timed out waiting for " + (label || expression) + " last=" + last);
}

async function shot(send, name, clip) {
  const params = { format: "png" };
  if (clip) params.clip = clip;
  const result = await send("Page.captureScreenshot", params);
  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(path.join(ART, name), Buffer.from(result.data, "base64"));
}

async function click(send, selector) {
  const rect = await evaluate(send, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  })()`);
  assert.ok(rect && rect.w > 0, "nothing to click: " + selector);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
}

async function key(send, name, code, vk, modifiers) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: name,
    code: code,
    windowsVirtualKeyCode: vk,
    modifiers: modifiers || 0,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: name,
    code: code,
    windowsVirtualKeyCode: vk,
    modifiers: modifiers || 0,
  });
}

async function heroClip(send) {
  return evaluate(send, `(() => {
    const el = document.getElementById("home-streak");
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.width), height: Math.max(1, r.height), scale: 1 };
  })()`);
}

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const server = await startServer();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yantra-quiet-"));
  const chrome = spawn("/usr/local/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=" + DEBUG,
    "--remote-allow-origins=*",
    "--user-data-dir=" + dir,
    "--window-size=1280,900",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", (chunk) => { chromeLog += chunk.toString(); });
  try {
    const page = await waitForPort();
    const client = connect(page.webSocketDebuggerUrl);
    await client.ready;
    const send = client.send;
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem(${JSON.stringify("yantra.settings.v1")}, JSON.stringify({
        "welcome.seen": { value: true, updatedAt: 1 },
        "access.level": { value: "zazen", updatedAt: 1 }
      })); } catch (e) {}`,
    });
    await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/web/" });
    await waitFor(send, "!!(window.YantraQuiet && window.YantraPractice && window.showCompletion && document.getElementById('done-segue'))", "app");
    await waitFor(send, "window.yantraQuoteFile && window.yantraQuoteFile.quotes && window.yantraQuoteFile.quotes.length > 0", "quotes");

    const initial = await evaluate(send, `(() => {
      const segue = document.getElementById("done-segue");
      const hero = document.getElementById("home-streak");
      const audio = document.querySelector("#talks-list audio");
      segue.style.display = "flex";
      const hiddenDisplay = getComputedStyle(segue).display;
      const cal = document.getElementById("practice-cal");
      cal.style.display = "grid";
      const calDisplay = getComputedStyle(cal).display;
      return {
        home: document.getElementById("home").hidden === false,
        segueHidden: segue.hidden === true,
        heroHidden: hero.hidden === true,
        audioSrc: audio ? (audio.getAttribute("src") || "") : "",
        hiddenDisplay,
        calDisplay,
        level: window.YANTRA_LEVEL,
      };
    })()`);
    assert.strictEqual(initial.level, "zazen");
    assert.strictEqual(initial.home, true, "the web edition opens on home");
    assert.strictEqual(initial.segueHidden, true, "the invitation is hidden before a sit");
    assert.strictEqual(initial.heroHidden, true, "the streak trail is hidden with no formal days");
    assert.strictEqual(initial.audioSrc, "");
    assert.strictEqual(initial.hiddenDisplay, "none", "hidden wins over an inline flex display");
    assert.strictEqual(initial.calDisplay, "none", "hidden wins over an inline grid display");

    const seeded = await evaluate(send, `(() => {
      let store = YantraPractice.empty();
      const today = new Date();
      for (let i = 41; i >= 0; i -= 1) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const date = YantraPractice.localDate(d);
        store = YantraPractice.record(store, { date, theme: "morning", ms: YantraPractice.MIN_MS }).store;
        if (i % 2 === 0) store = YantraPractice.record(store, { date, theme: "evening", ms: YantraPractice.MIN_MS }).store;
      }
      YantraPractice.save(store);
      paintPractice();
      const summary = YantraPractice.summary();
      const buttons = document.querySelectorAll("#streak-days button");
      return {
        daily: summary.streaks.daily.current,
        weekly: summary.streaks.weekly.current,
        continuous: document.getElementById("streak-continuous").textContent,
        weeklyText: document.getElementById("streak-weekly").textContent,
        buttons: buttons.length,
        heroHidden: document.getElementById("home-streak").hidden,
        label: buttons[0] ? buttons[0].getAttribute("aria-label") : "",
        svg: buttons[buttons.length - 1] ? buttons[buttons.length - 1].innerHTML.slice(0, 80) : "",
        box: buttons[0] ? Math.round(buttons[0].getBoundingClientRect().height) : 0,
      };
    })()`);
    assert.strictEqual(seeded.daily, 42);
    assert.strictEqual(seeded.weekly, 7);
    assert.strictEqual(seeded.continuous, "42 days");
    assert.strictEqual(seeded.weeklyText, "7 / 7 days");
    assert.strictEqual(seeded.heroHidden, false);
    assert.strictEqual(seeded.buttons, 14);
    assert.ok(seeded.svg && seeded.svg.includes("<svg"), "each day draws a mark");
    assert.ok(seeded.box >= 24, "the mark is large enough to see, got " + seeded.box);
    assert.ok(seeded.label.includes("Open the practice calendar"));
    await shot(send, "quiet-home-desktop.png");
    const deskClip = await heroClip(send);
    await shot(send, "quiet-hero-desktop.png", deskClip);

    await send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await sleep(100);
    await shot(send, "quiet-home-mobile.png");
    await send("Emulation.clearDeviceMetricsOverride");
    await sleep(50);

    await evaluate(send, `document.querySelector("#streak-days button").focus()`);
    await key(send, "Enter", "Enter", 13);
    await sleep(50);
    const opened = await evaluate(send, `(() => {
      const modal = document.getElementById("practice-cal");
      const formal = document.querySelectorAll("#practice-cal .cal-cell.formal").length;
      const morning = document.querySelectorAll("#practice-cal .cal-dot:not(.evening)").length;
      const evening = document.querySelectorAll("#practice-cal .cal-dot.evening").length;
      const sample = document.getElementById("practice-cal").innerText;
      return {
        open: modal.hidden === false,
        role: modal.getAttribute("role"),
        focus: document.activeElement && document.activeElement.id,
        formal, morning, evening,
        sample: sample.includes("Sample") || sample.includes("illustrative"),
        listening: sample.includes("Listening is not shown"),
      };
    })()`);
    assert.strictEqual(opened.open, true, "Enter on a streak day opens the calendar");
    assert.strictEqual(opened.role, "dialog");
    assert.strictEqual(opened.focus, "practice-cal-close");
    assert.ok(opened.formal > 0, "the calendar shows real formal days");
    assert.ok(opened.morning > 0);
    assert.ok(opened.evening > 0);
    assert.strictEqual(opened.sample, false);
    assert.strictEqual(opened.listening, true);
    await shot(send, "quiet-calendar.png");

    await click(send, "#practice-cal-prev");
    const monthMoved = await evaluate(send, `document.getElementById("practice-cal-next").disabled === false`);
    assert.strictEqual(monthMoved, true, "previous month leaves a way forward");
    await evaluate(send, `document.getElementById("practice-cal-next").focus()`);
    await key(send, "Tab", "Tab", 9, 0);
    const wrapped = await evaluate(send, `document.activeElement && document.activeElement.id`);
    assert.strictEqual(wrapped, "practice-cal-close", "Tab wraps inside the dialog");
    const shifted = await evaluate(send, `(() => {
      document.getElementById("practice-cal-close").focus();
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      return { id: document.activeElement && document.activeElement.id, defaulted: event.defaultPrevented };
    })()`);
    assert.strictEqual(shifted.defaulted, true);
    assert.strictEqual(shifted.id, "practice-cal-next", "shift-tab wraps inside the dialog");
    await key(send, "Escape", "Escape", 27);
    const closed = await evaluate(send, `(() => {
      const back = document.activeElement;
      return {
        hidden: document.getElementById("practice-cal").hidden === true,
        focus: back && back.classList.contains("day-btn"),
      };
    })()`);
    assert.strictEqual(closed.hidden, true);
    assert.strictEqual(closed.focus, true, "Escape returns focus to the streak day");

    const rollover = await evaluate(send, `(() => {
      const evening = YantraPractice.record(YantraPractice.empty(), {
        theme: "evening", ms: YantraPractice.MIN_MS, at: new Date(2026, 10, 9, 1, 0).getTime(),
      }).store;
      const morning = YantraPractice.record(YantraPractice.empty(), {
        theme: "morning", ms: YantraPractice.MIN_MS, at: new Date(2026, 10, 9, 1, 0).getTime(),
      }).store;
      const late = YantraQuiet.monthCells(2026, 11, evening.days);
      const dawn = YantraQuiet.monthCells(2026, 11, morning.days);
      const day = (book, n) => book.cells.find((cell) => cell.day === n);
      return {
        eveningOn8: !!day(late, 8).evening,
        eveningOn9: !!day(late, 9).formal,
        morningOn9: !!day(dawn, 9).morning,
        morningOn8: !!day(dawn, 8).formal,
      };
    })()`);
    assert.strictEqual(rollover.eveningOn8, true);
    assert.strictEqual(rollover.eveningOn9, false);
    assert.strictEqual(rollover.morningOn9, true);
    assert.strictEqual(rollover.morningOn8, false);

    const before = await evaluate(send, `(() => {
      const summary = YantraPractice.summary();
      return { sits: summary.totals.sits, ms: summary.totals.ms };
    })()`);
    const done = await evaluate(send, `(() => {
      showCompletion();
      const quote = document.getElementById("done-quote").textContent;
      const known = (window.yantraQuotes || []).some((row) => quote === "\\u201c" + row.text + "\\u201d");
      const segue = document.getElementById("done-segue");
      const audio = document.querySelector("#talks-list audio");
      return {
        room: document.getElementById("done").hidden === false,
        known,
        segueHidden: segue.hidden,
        text: segue.textContent,
        src: segue.dataset.src || "",
        audio: audio.getAttribute("src") || "",
        paused: audio.paused !== false,
      };
    })()`);
    assert.strictEqual(done.room, true);
    assert.strictEqual(done.known, true, "the completion line is a real quote from quotes.json");
    assert.strictEqual(done.segueHidden, false);
    assert.strictEqual(done.text, "Continue with a Dharma talk");
    assert.ok(done.src.startsWith("/talks/"));
    assert.strictEqual(done.audio, "", "the invitation does not start the talk");
    await shot(send, "quiet-done-segue.png");

    await click(send, "#done-segue");
    await sleep(150);
    const playing = await evaluate(send, `(() => {
      const audio = document.querySelector("#talks-list audio");
      const summary = YantraPractice.summary();
      return {
        src: audio.getAttribute("src") || "",
        watching: document.body.classList.contains("watching"),
        stop: document.getElementById("talk-stop").hidden === false,
        back: document.getElementById("talk-still").hidden === false,
        sits: summary.totals.sits,
        ms: summary.totals.ms,
        title: document.getElementById("talk-title").textContent,
      };
    })()`);
    assert.ok(playing.src.startsWith("/talks/"), "a tap starts a real talk");
    assert.strictEqual(playing.watching, true);
    assert.strictEqual(playing.stop, true);
    assert.strictEqual(playing.back, true);
    assert.strictEqual(playing.sits, before.sits, "the talk does not add a formal sit");
    assert.strictEqual(playing.ms, before.ms);
    assert.ok(playing.title.length > 0);
    await shot(send, "quiet-segue-playing.png");

    await click(send, "#talk-stop");
    await sleep(50);
    const stopped = await evaluate(send, `(() => {
      const audio = document.querySelector("#talks-list audio");
      return {
        paused: audio.paused === true,
        watching: document.body.classList.contains("watching"),
        done: document.getElementById("done").hidden === false,
        focus: document.activeElement && document.activeElement.id,
        sits: YantraPractice.summary().totals.sits,
      };
    })()`);
    assert.strictEqual(stopped.paused, true);
    assert.strictEqual(stopped.watching, false);
    assert.strictEqual(stopped.done, true);
    assert.strictEqual(stopped.focus, "done-segue");
    assert.strictEqual(stopped.sits, before.sits);

    await send("Network.emulateNetworkConditions", {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    const offline = await evaluate(send, `(() => {
      window.yantraKeptTalks = new Set();
      showCompletion();
      const hidden = document.getElementById("done-segue").hidden === true;
      window.yantraKeptTalks = new Set(["/talks/meditation.mp3"]);
      paintSegue();
      const btn = document.getElementById("done-segue");
      return { hidden, shown: btn.hidden === false, src: btn.dataset.src || "", offline: navigator.onLine === false };
    })()`);
    assert.strictEqual(offline.offline, true);
    assert.strictEqual(offline.hidden, true, "offline with nothing kept hides the invitation");
    assert.strictEqual(offline.shown, true, "a kept talk can still be offered offline");
    assert.strictEqual(offline.src, "/talks/meditation.mp3");
    await shot(send, "quiet-done-offline-kept.png");

    await send("Network.emulateNetworkConditions", {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    await evaluate(send, `window.dispatchEvent(new Event("online"))`);

    const sangha = await evaluate(send, `(() => {
      const previous = window.YANTRA_LEVEL;
      window.YANTRA_LEVEL = "sangha";
      showCompletion();
      const hidden = document.getElementById("done-segue").hidden === true;
      const quote = document.getElementById("done-words").hidden === true;
      window.YANTRA_LEVEL = previous;
      return { hidden, quote };
    })()`);
    assert.strictEqual(sangha.hidden, true, "the invitation is Zazen only");
    assert.strictEqual(sangha.quote, true);

    await evaluate(send, `window.YANTRA_LEVEL = "zazen"; showRoom("home");`);
    for (const days of [7, 30, 90, 180, 365]) {
      const form = await evaluate(send, `(() => {
        const n = ${days};
        let store = YantraPractice.empty();
        const today = new Date();
        for (let i = n - 1; i >= 0; i -= 1) {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
          store = YantraPractice.record(store, { date: YantraPractice.localDate(d), theme: "morning", ms: YantraPractice.MIN_MS }).store;
        }
        YantraPractice.save(store);
        paintPractice();
        showRoom("home");
        const summary = YantraPractice.summary();
        const buttons = Array.from(document.querySelectorAll("#streak-days button"));
        const last = buttons[buttons.length - 1];
        return {
          weekly: summary.streaks.weekly.current,
          daily: summary.streaks.daily.current,
          count: buttons.length,
          label: last ? last.getAttribute("aria-label") : "",
          svg: last ? last.innerHTML : "",
        };
      })()`);
      assert.strictEqual(form.daily, days);
      assert.strictEqual(form.weekly, days >= 7 ? 7 : days);
      assert.strictEqual(form.count, Math.min(14, days));
      assert.ok(form.label.includes("Day " + days));
      if (days === 7) assert.ok(form.svg.includes("<path"), "the seventh day is an open ring");
      if (days === 30) assert.ok(form.svg.includes("<path"), "the month draws a lotus");
      if (days === 365) assert.ok(form.svg.includes("<path"), "the year draws a full circle");
      const clip = await heroClip(send);
      await shot(send, "quiet-form-" + days + ".png", clip);
    }

    const long = await evaluate(send, `YantraPractice.summary().streaks.weekly.current`);
    assert.strictEqual(long, 7, "a year still shows 7 / 7, not a new cycle");
    console.log("quiet.browser.test.js ok");
    client.close();
  } catch (err) {
    console.error(err);
    if (chromeLog) console.error(chromeLog.slice(-2000));
    process.exitCode = 1;
  } finally {
    chrome.kill("SIGKILL");
    server.close();
  }
})();
