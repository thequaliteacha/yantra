/* node web/sync.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Practice = require("./practice.js");
const Sync = require("./sync.js");

function memory() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(key); },
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] || null; },
  };
}

function use(store) {
  global.localStorage = store;
}

function day(theme, ms) {
  const row = { ms: ms == null ? 60000 : ms, sits: 1, morning: 0, evening: 0, other: 0 };
  row[theme] = 1;
  return row;
}

function picture(days, today) {
  const store = Practice.empty();
  store.days = days;
  store.totals = Practice.totalsFromDays(days);
  return Practice.summarize(store, new Date(today + "T12:00:00"));
}

function server() {
  const blobs = new Map();
  const gone = new Set();
  const blocked = new Set();
  const seen = [];
  let offline = false;
  async function handler(url, init) {
    if (offline) throw new Error("offline");
    const address = new URL(url, "https://yantramedi.app");
    const method = String((init && init.method) || "GET").toUpperCase();
    const body = init && init.body ? String(init.body) : "";
    seen.push({ method: method, path: address.pathname, body: body });
    const parts = address.pathname.split("/").filter(Boolean);
    const lookup = parts[2] || "";
    const device = parts[3] || "";
    if (gone.has(lookup) && method !== "DELETE") {
      return new Response(JSON.stringify({ error: "forgotten" }), { status: 410, headers: { "content-type": "application/json" } });
    }
    const mapKey = lookup + "/" + device;
    if (method === "PUT") {
      if (blocked.has(mapKey)) {
        return new Response(JSON.stringify({ error: "removed" }), { status: 403, headers: { "content-type": "application/json" } });
      }
      const parsed = JSON.parse(body);
      blobs.set(mapKey, { iv: parsed.iv, ct: parsed.ct, at: Date.now() });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "GET" && !device) {
      const devices = [];
      blobs.forEach((value, key) => {
        if (!key.startsWith(lookup + "/")) return;
        devices.push({ id: key.slice(lookup.length + 1), iv: value.iv, ct: value.ct, at: value.at });
      });
      return new Response(JSON.stringify({ devices: devices }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "DELETE" && device) {
      blobs.delete(mapKey);
      blocked.add(mapKey);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "DELETE") {
      gone.add(lookup);
      Array.from(blobs.keys()).forEach((key) => {
        if (key.startsWith(lookup + "/")) blobs.delete(key);
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("no", { status: 405 });
  }
  return {
    handler: handler,
    seen: seen,
    blobs: blobs,
    setOffline(next) { offline = !!next; },
  };
}

const net = server();
global.fetch = (url, init) => net.handler(url, init);

(async () => {
  const key = Sync.generatePracticeKey();
  const other = Sync.generatePracticeKey();
  assert.notStrictEqual(key, other);
  assert.strictEqual(Sync.parseKey(key), key);
  assert.strictEqual(Sync.parseKey("https://yantramedi.app/web/#link=" + key), key);
  assert.strictEqual(Sync.parseKey("  #link=" + key + " "), key);
  assert.strictEqual(Sync.parseKey("not-a-key"), "");
  assert.strictEqual(Sync.linkFor(key), "https://yantramedi.app/web/#link=" + key);

  const derived = await Sync.derive(key);
  const again = await Sync.derive(key);
  const stranger = await Sync.derive(other);
  assert.strictEqual(derived.lookupId, again.lookupId);
  assert.match(derived.lookupId, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(derived.lookupId, stranger.lookupId);
  assert.strictEqual(derived.lookupId.includes(key), false);
  assert.notStrictEqual(derived.lookupId, key);

  const payload = {
    v: 1,
    name: "iPad",
    days: { "2026-10-22": day("morning", 60000) },
  };
  const deviceA = "a".repeat(32);
  const deviceB = "b".repeat(32);
  const envelope = await Sync.encrypt(derived.aesKey, payload, deviceA);
  const plain = await Sync.decrypt(derived.aesKey, envelope, deviceA);
  assert.strictEqual(plain.name, "iPad");
  assert.deepStrictEqual(plain.days, payload.days);
  const second = await Sync.encrypt(derived.aesKey, payload, deviceA);
  assert.notStrictEqual(second.iv + second.ct, envelope.iv + envelope.ct);
  await assert.rejects(() => Sync.decrypt(stranger.aesKey, envelope, deviceA));
  await assert.rejects(() => Sync.decrypt(derived.aesKey, envelope, deviceB));
  const tampered = { iv: envelope.iv, ct: envelope.ct.slice(0, -2) + (envelope.ct.endsWith("a") ? "b" : "a") };
  await assert.rejects(() => Sync.decrypt(derived.aesKey, tampered, deviceA));

  const matrix = Sync.qrMatrix(Sync.linkFor(key));
  assert.ok(matrix && matrix.length >= 21);
  assert.strictEqual(matrix[0][0], true);
  assert.strictEqual(matrix[1][1], false);
  assert.strictEqual(matrix[2][2], true);
  assert.strictEqual(matrix[6][6], true);
  assert.strictEqual(matrix[0][matrix.length - 1], true);

  const morning = { deviceId: deviceA, days: { "2026-10-22": day("morning", 60000) } };
  const evening = { deviceId: deviceB, days: { "2026-10-22": day("evening", 120000) } };
  const shelf = { deviceId: "c".repeat(32), days: { "2026-10-22": day("other", 60000) } };
  const sameDay = Practice.mergeDays([morning, evening, shelf]);
  assert.strictEqual(sameDay["2026-10-22"].morning, 1);
  assert.strictEqual(sameDay["2026-10-22"].evening, 1);
  assert.strictEqual(sameDay["2026-10-22"].other, 1);
  assert.strictEqual(sameDay["2026-10-22"].sits, 3);
  assert.strictEqual(sameDay["2026-10-22"].ms, 240000);
  assert.deepStrictEqual(sameDay, Practice.mergeDays([evening, shelf, morning, morning, evening]));
  assert.deepStrictEqual(sameDay, Practice.mergeDays([shelf, morning, evening]));
  assert.strictEqual(Practice.mergeDays([morning, morning])["2026-10-22"].sits, 1, "the same device is counted once");
  const perfect = picture(Practice.mergeDays([morning, evening]), "2026-10-22");
  assert.strictEqual(perfect.streaks.perfect.current, 1, "morning on A and evening on B make a perfect day");
  assert.strictEqual(perfect.streaks.morning.current, 1);
  assert.strictEqual(perfect.streaks.evening.current, 1);
  assert.strictEqual(perfect.totals.sits, 2);
  assert.strictEqual(perfect.totals.ms, 180000);

  const aDays = {};
  const bDays = {};
  ["2026-10-17", "2026-10-19", "2026-10-21"].forEach((date) => { aDays[date] = day("morning"); });
  ["2026-10-18", "2026-10-20", "2026-10-22"].forEach((date) => { bDays[date] = day("morning"); });
  const alternated = Practice.mergeDays([
    { deviceId: deviceA, days: aDays },
    { deviceId: deviceB, days: bDays },
  ]);
  const run = picture(alternated, "2026-10-22");
  assert.strictEqual(run.streaks.morning.current, 6, "alternating days across devices keep the morning run");
  assert.strictEqual(run.streaks.morning.best, 6);
  assert.strictEqual(run.streaks.daily.current, 6);
  assert.deepStrictEqual(alternated, Practice.mergeDays([
    { deviceId: deviceB, days: bDays },
    { deviceId: deviceA, days: aDays },
    { deviceId: deviceA, days: aDays },
  ]));

  use(memory());
  assert.strictEqual(Sync.linked(), false);
  assert.strictEqual(Sync.ruleLine(), Practice.RULE);
  Practice.commit({ date: "2026-10-22", theme: "morning", ms: Practice.MIN_MS });
  await Sync.settled();
  assert.strictEqual(Practice.summary().totals.sits, 1);
  assert.strictEqual(Practice.load().days["2026-10-22"].morning, 1);
  assert.deepStrictEqual(Sync.devices(), []);

  const when = new Date("2026-10-22T12:00:00");
  const ipad = memory();
  const phone = memory();
  use(ipad);
  const linked = Sync.linkNew({ name: "iPad" });
  assert.strictEqual(linked.created, true);
  assert.strictEqual(Sync.linkFor(linked.practiceKey), linked.link);
  await Sync.sync();
  for (const date of ["2026-10-17", "2026-10-19", "2026-10-21", "2026-10-22"]) {
    Practice.commit({ date: date, theme: "morning", ms: 60000 });
    await Sync.settled();
  }

  use(phone);
  const joined = Sync.join(linked.link, { name: "Phone" });
  assert.strictEqual(joined.ok, true);
  assert.strictEqual(joined.practiceKey, linked.practiceKey);
  const pasted = Sync.join(linked.practiceKey, { name: "Phone" });
  assert.strictEqual(pasted.deviceId, joined.deviceId, "pasting the key again keeps this device");
  await Sync.sync();
  for (const date of ["2026-10-18", "2026-10-20"]) {
    Practice.commit({ date: date, theme: "morning", ms: 60000 });
    await Sync.settled();
  }
  Practice.commit({ date: "2026-10-22", theme: "evening", ms: 120000 });
  await Sync.settled();

  use(ipad);
  await Sync.sync();
  let shared = Practice.summarize(Sync.currentStore(), when);
  assert.strictEqual(shared.streaks.morning.current, 6);
  assert.strictEqual(shared.streaks.evening.current, 1);
  assert.strictEqual(shared.streaks.perfect.current, 1);
  assert.strictEqual(shared.streaks.daily.current, 6);
  assert.strictEqual(shared.totals.sits, 7);
  assert.strictEqual(shared.totals.ms, 480000);
  assert.strictEqual(Practice.load().days["2026-10-22"].morning, 1);
  assert.strictEqual(Practice.load().days["2026-10-22"].evening, 0, "the other device's sit stays out of the local log");
  assert.strictEqual(Sync.currentStore().days["2026-10-22"].evening, 1);
  assert.strictEqual(Sync.currentStore().days["2026-10-22"].morning, 1);
  const names = Sync.devices().map((device) => device.name).sort();
  assert.deepStrictEqual(names, ["Phone", "iPad"]);
  assert.strictEqual(Sync.ruleLine().includes("Linked devices share the days."), true);

  const sits = shared.totals.sits;
  await Sync.sync();
  await Sync.sync();
  shared = Practice.summarize(Sync.currentStore(), when);
  assert.strictEqual(shared.totals.sits, sits, "syncing again does not add sits");
  assert.strictEqual(shared.streaks.perfect.current, 1);
  assert.strictEqual(Practice.load().totals.sits, 4, "this device's own log is unchanged by a pull");

  use(phone);
  net.setOffline(true);
  Practice.commit({ date: "2026-10-21", theme: "evening", ms: 60000 });
  await Sync.settled();
  assert.strictEqual(Sync.loadState().pending, true);
  assert.strictEqual(Practice.load().days["2026-10-21"].evening, 1);
  assert.strictEqual(Sync.currentStore().days["2026-10-21"].evening, 1, "an offline sit is already in the merged view");
  assert.strictEqual(Practice.summarize(Sync.currentStore(), when).streaks.perfect.current, 2);
  use(ipad);
  assert.strictEqual(Sync.currentStore().days["2026-10-21"].evening || 0, 0);

  net.setOffline(false);
  use(phone);
  await Sync.sync();
  assert.strictEqual(Sync.loadState().pending, false);
  use(ipad);
  await Sync.sync();
  shared = Practice.summarize(Sync.currentStore(), when);
  assert.strictEqual(shared.streaks.perfect.current, 2);
  assert.strictEqual(shared.totals.sits, 8);
  await Sync.sync();
  assert.strictEqual(Practice.summarize(Sync.currentStore(), when).totals.sits, 8);

  const practiceKey = linked.practiceKey;
  net.seen.forEach((entry) => {
    assert.strictEqual(entry.path.includes(practiceKey), false);
    assert.strictEqual(entry.body.includes(practiceKey), false);
    if (!entry.body) return;
    const parsed = JSON.parse(entry.body);
    assert.strictEqual(parsed.days, undefined);
    assert.strictEqual(parsed.name, undefined);
    assert.strictEqual(parsed.practiceKey, undefined);
    assert.ok(parsed.iv && parsed.ct);
  });
  const material = await Sync.derive(practiceKey);
  assert.ok(net.seen.some((entry) => entry.path.includes("/api/practice/" + material.lookupId + "/")));

  use(ipad);
  const ipadSits = Practice.load().totals.sits;
  await Sync.forget();
  assert.strictEqual(Sync.linked(), false);
  assert.strictEqual(Practice.load().totals.sits, ipadSits, "forgetting the key keeps the local sits");
  use(phone);
  const phoneSits = Practice.load().totals.sits;
  await Sync.sync();
  assert.strictEqual(Sync.linked(), false, "the other device learns the key is gone");
  assert.strictEqual(Practice.load().totals.sits, phoneSits);

  const tablet = memory();
  const laptop = memory();
  use(tablet);
  const made = Sync.linkNew({ name: "Tablet" });
  await Sync.sync();
  Practice.commit({ date: "2026-10-22", theme: "morning", ms: 60000 });
  await Sync.settled();
  use(laptop);
  Sync.join(made.practiceKey, { name: "Laptop" });
  await Sync.sync();
  Practice.commit({ date: "2026-10-22", theme: "evening", ms: 60000 });
  await Sync.settled();
  use(tablet);
  await Sync.sync();
  assert.strictEqual(Practice.summarize(Sync.currentStore(), when).streaks.perfect.current, 1);
  const removed = Sync.devices().find((device) => device.name === "Laptop");
  assert.ok(removed);
  await Sync.removeDevice(removed.id);
  assert.strictEqual(Sync.devices().some((device) => device.name === "Laptop"), false);
  assert.strictEqual(Sync.currentStore().days["2026-10-22"].evening || 0, 0);
  assert.strictEqual(Practice.load().days["2026-10-22"].morning, 1);
  use(laptop);
  const laptopSits = Practice.load().totals.sits;
  await Sync.sync();
  assert.strictEqual(Sync.linked(), false, "a removed device drops the key on its next sync");
  assert.strictEqual(Practice.load().totals.sits, laptopSits);
  assert.strictEqual(Practice.load().days["2026-10-22"].evening, 1);

  use(memory());
  const solo = Sync.linkNew({ name: "Computer" });
  await Sync.sync();
  Practice.commit({ date: "2026-10-22", theme: "evening", ms: 60000 });
  await Sync.settled();
  await Sync.unlink();
  assert.strictEqual(Sync.linked(), false);
  assert.strictEqual(Sync.ruleLine(), Practice.RULE);
  assert.strictEqual(Practice.load().days["2026-10-22"].evening, 1);

  const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/worker.js"), "utf8");
  const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
  const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
  assert.ok(page.includes("Link my devices"));
  assert.ok(page.includes("Unlink this device"));
  assert.ok(page.includes("Remove a device"));
  assert.ok(page.includes("Forget this practice key everywhere"));
  assert.ok(page.includes('id="practice-link"'));
  assert.ok(page.includes('id="practice-link-qr"'));
  assert.ok(loader.includes('src="qrcode.js"'));
  assert.ok(loader.includes('src="sync.js"'));
  assert.ok(sw.includes('url.pathname.startsWith("/api/")'));
  assert.ok(web.includes('!url.startsWith("/api/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/api/practice/")'));
  assert.ok(worker.includes("practiceRoute"));
  assert.strictEqual(/console\.(log|info|debug|warn|error)/.test(fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/practice.js"), "utf8")), false);

  console.log("sync.test.js ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
