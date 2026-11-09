/* node web/quiet.browser.test.js
 *
 * Opens the real web edition in Chrome and exercises the quiet streak,
 * the practice calendar, and the Dharma invitation. Screenshots go to
 * $YANTRA_ARTIFACTS when that directory is set, otherwise a folder under
 * the system temp directory. Either place is created as the current user.
 * The browser is $YANTRA_CHROME, or the first Chrome/Chromium found on PATH
 * and then at the usual locations, including /usr/bin/chromium.
 */
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

/* A directory the current user can create. An explicit path wins; the
   default never tries /opt, which an ordinary account cannot mkdir. */
function artifactDir(env, tmp) {
  const configured = env && typeof env.YANTRA_ARTIFACTS === "string" ? env.YANTRA_ARTIFACTS.trim() : "";
  if (configured) return path.resolve(configured);
  return path.join(tmp || os.tmpdir(), "yantra-quiet-artifacts");
}

/* Names tried on PATH, then absolute paths. Chromium on Arch lives at
   /usr/bin/chromium. Brave is last so it is used only when nothing else
   is installed. YANTRA_CHROME overrides the search. */
const CHROME_NAMES = ["chromium", "google-chrome", "google-chrome-stable", "chromium-browser", "chrome"];
const CHROME_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/local/bin/google-chrome",
  "/usr/local/bin/chromium",
  "/opt/google/chrome/chrome",
  "/snap/bin/chromium",
  "/usr/bin/brave",
  "/usr/bin/brave-browser",
];

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function resolveCommand(command, pathEnv, exists) {
  const text = String(command || "");
  if (!text) return "";
  if (text.includes("/") || text.includes("\\")) {
    const full = path.resolve(text);
    return exists(full) ? full : "";
  }
  const dirs = String(pathEnv || "").split(path.delimiter);
  for (let i = 0; i < dirs.length; i += 1) {
    if (!dirs[i]) continue;
    const full = path.join(dirs[i], text);
    if (exists(full)) return full;
  }
  return "";
}

function chromeExecutable(env, opts) {
  const options = opts || {};
  const exists = options.exists || isExecutable;
  const pathEnv = options.pathEnv != null ? options.pathEnv : (env && env.PATH) || "";
  const configured = env && typeof env.YANTRA_CHROME === "string" ? env.YANTRA_CHROME.trim() : "";
  if (configured) {
    const found = resolveCommand(configured, pathEnv, exists);
    if (!found) throw new Error("YANTRA_CHROME is not an executable file: " + configured);
    return found;
  }
  for (let i = 0; i < CHROME_NAMES.length; i += 1) {
    const found = resolveCommand(CHROME_NAMES[i], pathEnv, exists);
    if (found) return found;
  }
  for (let i = 0; i < CHROME_PATHS.length; i += 1) {
    if (exists(CHROME_PATHS[i])) return CHROME_PATHS[i];
  }
  throw new Error("No Chrome or Chromium found. Set YANTRA_CHROME to the browser, for example /usr/bin/chromium.");
}

const ART = artifactDir(process.env);

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

function silentWav(seconds) {
  const rate = 8000;
  const samples = Math.floor(rate * seconds);
  const data = Buffer.alloc(samples, 128);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, data]);
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
        if (err && pathname.includes("/audio/") && pathname.endsWith(".mp3")) {
          res.writeHead(200, { "content-type": "audio/wav", "cache-control": "no-store" });
          res.end(silentWav(6));
          return;
        }
        if (err) {
          res.writeHead(404);
          res.end("missing");
          return;
        }
        res.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (err) { reject(err); }
      });
    });
    req.on("error", reject);
  });
}

async function waitForPort(port) {
  const url = "http://127.0.0.1:" + port + "/json/list";
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await getJson(url);
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

const TYPE_PROBE = `(function () {
  function parse(c) {
    const m = String(c || "").match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(p) { return 0.2126 * lin(p.r) + 0.7152 * lin(p.g) + 0.0722 * lin(p.b); }
  function ratio(fg, bg) {
    const hi = Math.max(lum(fg), lum(bg));
    const lo = Math.min(lum(fg), lum(bg));
    return (hi + 0.05) / (lo + 0.05);
  }
  function chain(el) {
    let o = 1;
    let n = el;
    while (n && n.nodeType === 1) {
      const a = Number(getComputedStyle(n).opacity);
      if (Number.isFinite(a)) o *= a;
      n = n.parentElement;
    }
    return o;
  }
  function measure(el) {
    if (!el || el.hidden) return null;
    const cs = getComputedStyle(el);
    const color = parse(cs.color);
    const opacity = chain(el);
    const fgA = color.a * opacity;
    const bg = { r: 5, g: 4, b: 10 };
    const fg = {
      r: color.r * fgA + bg.r * (1 - fgA),
      g: color.g * fgA + bg.g * (1 - fgA),
      b: color.b * fgA + bg.b * (1 - fgA),
    };
    return {
      opacity: Math.round(opacity * 1000) / 1000,
      color: cs.color,
      contrast: Math.round(ratio(fg, bg) * 100) / 100,
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
    };
  }
  const ids = {
    quote: document.getElementById("done-quote"),
    segue: document.getElementById("done-segue"),
    line: document.getElementById("done-line"),
    home: document.querySelector("#home h1"),
    label: document.querySelector(".streak-label"),
    value: document.getElementById("streak-continuous"),
    play: document.getElementById("talk-stop"),
  };
  const out = {};
  Object.keys(ids).forEach((key) => {
    const row = measure(ids[key]);
    if (row) out[key] = row;
  });
  return out;
})`;

async function installProbe(send) {
  await evaluate(send, "window.__yantraType = " + TYPE_PROBE);
}

async function readType(send) {
  return evaluate(send, "window.__yantraType()");
}

function assertReadable(sample, name, minContrast) {
  assert.ok(sample && sample[name], name + " was not measured");
  assert.ok(sample[name].opacity >= 0.95, name + " settled opacity " + sample[name].opacity);
  assert.ok(sample[name].contrast >= minContrast, name + " contrast " + sample[name].contrast + " (" + sample[name].color + ")");
}

async function heroClip(send) {
  return evaluate(send, `(() => {
    const el = document.getElementById("home-streak");
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.width), height: Math.max(1, r.height), scale: 1 };
  })()`);
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const browser = chromeExecutable(process.env);
  const debugPort = await freePort();
  console.log("artifacts", ART);
  console.log("browser", browser);
  const server = await startServer();
  const pagePort = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yantra-quiet-"));
  const chrome = spawn(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=" + debugPort,
    "--remote-allow-origins=*",
    "--user-data-dir=" + dir,
    "--window-size=1280,900",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", (chunk) => { chromeLog += chunk.toString(); });
  try {
    const page = await waitForPort(debugPort);
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
    await send("Page.navigate", { url: "http://127.0.0.1:" + pagePort + "/web/" });
    await waitFor(send, "!!(window.YantraQuiet && window.YantraPractice && window.showCompletion && document.getElementById('done-segue'))", "app");
    await waitFor(send, "window.yantraQuoteFile && window.yantraQuoteFile.quotes && window.yantraQuoteFile.quotes.length > 0", "quotes");
    await installProbe(send);

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
    const homeEarly = await readType(send);
    const homeRunning = await evaluate(send, `document.querySelector("#home .inner").getAnimations().filter((anim) => anim.playState === "running").length`);
    await evaluate(send, `document.querySelector("#home .inner").getAnimations().forEach((anim) => anim.finish())`);
    await sleep(80);
    const homeType = await readType(send);
    console.log("home fade", JSON.stringify({ running: homeRunning, early: homeEarly.home, settled: homeType.home, label: homeType.label }));
    if (homeRunning) assert.ok(homeEarly.home.opacity < 0.85, "home is still inside the entrance fade when shot too soon, opacity " + homeEarly.home.opacity);
    assertReadable(homeType, "home", 7);
    assertReadable(homeType, "label", 4.5);
    assertReadable(homeType, "value", 7);
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
    const fade = await evaluate(send, `(async () => {
      showCompletion();
      const inner = document.querySelector("#done .inner");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const anims = inner.getAnimations();
      if (anims[0]) anims[0].currentTime = 0;
      const early = window.__yantraType();
      anims.forEach((anim) => anim.finish());
      const settled = window.__yantraType();
      return { animated: anims.length, early: early, settled: settled };
    })()`);
    console.log("completion fade", JSON.stringify(fade));
    assert.ok(fade.animated > 0, "the completion room still fades in");
    assert.ok(fade.early.quote.opacity <= 0.05, "the fade starts blank, opacity " + fade.early.quote.opacity);
    assert.ok(fade.early.quote.contrast < 1.5, "a mid-fade capture is not readable contrast");
    assertReadable(fade.settled, "quote", 7);
    assertReadable(fade.settled, "line", 7);
    assertReadable(fade.settled, "segue", 7);
    await sleep(80);
    await shot(send, "quiet-done-segue.png");
    await evaluate(send, `document.getElementById("done-segue").focus({ focusVisible: true })`);
    const focus = await readType(send);
    assert.strictEqual(focus.segue.outlineStyle, "solid");
    assert.ok(parseFloat(focus.segue.outlineWidth) >= 2, "focus ring " + focus.segue.outlineWidth);
    await shot(send, "quiet-done-focus.png");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await sleep(80);
    await shot(send, "quiet-done-mobile.png");
    await send("Emulation.clearDeviceMetricsOverride");

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
    await waitFor(send, `(() => {
      const bar = document.getElementById("talk-bar");
      if (!bar) return false;
      let o = 1;
      let n = bar;
      while (n && n.nodeType === 1) {
        o *= Number(getComputedStyle(n).opacity) || 1;
        n = n.parentElement;
      }
      return o >= 0.95;
    })()`, "playback controls");
    const playType = await readType(send);
    assertReadable(playType, "play", 4.5);
    console.log("playback contrast", JSON.stringify(playType.play));
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

    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    const reduced = await evaluate(send, `(async () => {
      showRoom("home");
      showCompletion();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const anims = document.querySelector("#done .inner").getAnimations();
      return { animated: anims.length, type: window.__yantraType() };
    })()`);
    console.log("reduced motion", JSON.stringify(reduced));
    assert.strictEqual(reduced.animated, 0, "reduced motion does not fade the completion text");
    assertReadable(reduced.type, "quote", 7);
    assertReadable(reduced.type, "segue", 7);
    await shot(send, "quiet-done-reduced.png");
    await evaluate(send, `showRoom("home"); document.getElementById("home").scrollTop = 0;`);
    await sleep(50);
    const reducedHome = await readType(send);
    assertReadable(reducedHome, "home", 7);
    assertReadable(reducedHome, "label", 4.5);
    await shot(send, "quiet-home-reduced.png");
    await evaluate(send, `document.getElementById("done-segue").click()`);
    await sleep(80);
    const reducedPlay = await readType(send);
    assertReadable(reducedPlay, "play", 4.5);
    await shot(send, "quiet-playing-reduced.png");
    await send("Emulation.setEmulatedMedia", { features: [] });

    const labels = await evaluate(send, `(() => {
      const talk = document.querySelector("#talks-list audio");
      if (talk && !talk.paused) talk.pause();
      const albums = ["Enlightenment", "Canyons of Light", "Samadhi", "Ecstasy"];
      const counts = [1, 3, 6, 12];
      const titles = counts.map((count, i) => {
        document.body.classList.add("sitting");
        armSitCaption(albums[i], "First song", "not-samurai");
        paintSitCaption();
        const title = document.getElementById("cap-title").textContent;
        document.body.classList.remove("sitting");
        return { count, title };
      });
      document.body.classList.remove("watching", "sitting");
      const close = document.getElementById("talk-close");
      if (close) close.click();
      showRoom("home");
      return { titles, shelf: document.getElementById("cap-title").textContent };
    })()`);
    labels.titles.forEach((row) => {
      assert.strictEqual(row.title, ["Enlightenment", "Canyons of Light", "Samadhi", "Ecstasy"][[1, 3, 6, 12].indexOf(row.count)]);
      assert.notStrictEqual(row.title, "Samurai", row.count + " songs must not open on Samurai");
    });

    await evaluate(send, `(() => {
      window.__completes = 0;
      window.__capLog = [];
      const title = document.getElementById("cap-title");
      new MutationObserver(() => window.__capLog.push(title.textContent)).observe(title, { childList: true, subtree: true, characterData: true });
      addEventListener("yantra:complete", () => { window.__completes += 1; });
      document.getElementById("done").hidden = true;
      showRoom("home");
      window.__sitsBefore = YantraPractice.summary().totals.sits;
    })()`);
    await click(send, "#home [data-theme=morning]");
    await waitFor(send, `!!document.querySelector("#pick-album option[value=enlightenment]")`, "enlightenment album");
    await evaluate(send, `(() => {
      const select = document.getElementById("pick-album");
      select.value = "enlightenment";
      select.dispatchEvent(new Event("change"));
      window.__capFrom = window.__capLog.length;
    })()`);
    await click(send, "#pick [data-count='1']");
    const sitOpen = await waitFor(send, `(() => {
      const title = document.getElementById("cap-title").textContent;
      if (title !== "Enlightenment") return false;
      return { title, volume: window.yantraSitAudio ? window.yantraSitAudio.volume : -1 };
    })()`, "album title and quiet open");
    assert.strictEqual(sitOpen.title, "Enlightenment");
    assert.ok(sitOpen.volume >= 0 && sitOpen.volume < 0.35, "the first track fades in, volume " + sitOpen.volume);
    await shot(send, "sit-open-album.png");
    const risen = await waitFor(send, `(() => {
      const audio = window.yantraSitAudio;
      if (!audio || audio.volume < 0.55) return false;
      return audio.volume;
    })()`, "fade in");
    assert.ok(risen > sitOpen.volume, "the opening gets louder");
    const faded = await waitFor(send, `(() => {
      const audio = window.yantraSitAudio;
      const title = document.getElementById("cap-title").textContent;
      if (!audio || !Number.isFinite(audio.duration) || audio.duration < 1) return false;
      if (audio.currentTime < audio.duration - 2.2) return false;
      if (audio.volume > 0.45) return false;
      return { volume: audio.volume, title, paused: audio.paused };
    })()`, "fade out");
    assert.ok(faded.volume < 0.45, "the last seconds are quiet, volume " + faded.volume);
    await waitFor(send, `document.getElementById("done").hidden === false && window.__completes === 1`, "one completion");
    const finished = await evaluate(send, `(() => {
      const during = window.__capLog.slice(window.__capFrom);
      return {
        completes: window.__completes,
        paused: !window.yantraSitAudio || window.yantraSitAudio.paused === true,
        sits: YantraPractice.summary().totals.sits,
        before: window.__sitsBefore,
        during,
        samurai: during.indexOf("Samurai") >= 0,
      };
    })()`);
    assert.strictEqual(finished.completes, 1, "completion is recorded once");
    assert.strictEqual(finished.paused, true, "the sit does not keep playing");
    assert.strictEqual(finished.sits, finished.before, "a short faded sit is not an extra formal credit");
    assert.strictEqual(finished.samurai, false, "Samurai never replaces the playing album");
    console.log("sit open", JSON.stringify({ opened: sitOpen.volume, risen, faded: faded.volume, during: finished.during }));
    await shot(send, "sit-fade-complete.png");

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
}

if (require.main === module) {
  main();
}

module.exports = { artifactDir, chromeExecutable, CHROME_NAMES, CHROME_PATHS };
