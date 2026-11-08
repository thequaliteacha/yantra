/* node web/quiet.test.js */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Q = require("./quiet.js");
const P = require("./practice.js");
const T = require("./talks.js");
const Sync = require("./sync.js");

function memory() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

const bounds = [
  [0, "plain"], [1, "plain"], [6, "plain"], [7, "enso"], [8, "enso"], [29, "enso"],
  [30, "lotus"], [31, "lotus"], [89, "lotus"], [90, "moon"], [91, "moon"],
  [179, "moon"], [180, "mandala"], [181, "mandala"], [364, "mandala"],
  [365, "year"], [400, "year"],
];
bounds.forEach((row) => {
  assert.strictEqual(Q.formForDays(row[0]), row[1], row[0] + " days");
});
assert.deepStrictEqual(Q.MILESTONES.map((mark) => mark.days), [7, 30, 90, 180, 365]);
assert.deepStrictEqual(Q.MILESTONES.map((mark) => mark.form), ["enso", "lotus", "moon", "mandala", "year"]);

assert.deepStrictEqual(Q.heroDays(0), []);
assert.deepStrictEqual(Q.heroDays(3), [1, 2, 3]);
assert.strictEqual(Q.heroDays(14).length, 14);
assert.strictEqual(Q.heroDays(15)[0], 2);
assert.strictEqual(Q.heroDays(15)[Q.heroDays(15).length - 1], 15);
assert.strictEqual(Q.heroDays(365).length, Q.HERO_CAP);
assert.strictEqual(Q.heroDays(365)[0], 365 - Q.HERO_CAP + 1);

assert.ok(Q.auraFor(7, 0) < Q.auraFor(30, 0));
assert.ok(Q.auraFor(30, 0) < Q.auraFor(365, 0));
assert.ok(Q.auraFor(30, 0) < Q.auraFor(30, 1000 * 60 * 60 * 1000), "practiced time deepens the glow without a new score");
assert.ok(Q.auraFor(365, 1e12) <= 0.72);
assert.ok(Q.auraFor(1, 0) >= 0.12);

const seedA = Q.accountMark("one-account-seed");
const seedB = Q.accountMark("another-account-seed");
assert.notStrictEqual(seedA, seedB);
assert.ok(seedA.startsWith("m") && !seedA.includes("one-account-seed"));
["enso", "lotus", "moon", "mandala", "year", "plain"].forEach((form) => {
  const once = Q.renderForm(form, 30, seedA, { auraDays: 30, formalMs: 0, size: 36 });
  const twice = Q.renderForm(form, 30, seedA, { auraDays: 30, formalMs: 0, size: 36 });
  const other = Q.renderForm(form, 30, seedB, { auraDays: 30, formalMs: 0, size: 36 });
  assert.strictEqual(once, twice, form + " stays the same for one account");
  assert.notStrictEqual(once, other, form + " changes with the account");
  assert.ok(once.startsWith("<svg"), form);
  assert.ok(once.includes("aria-hidden=\"true\""));
  assert.ok(!once.includes("one-account-seed"));
});
assert.ok(Q.renderForm("enso", 7, seedA).includes("<path"));
assert.ok(Q.renderForm("year", 365, seedA).includes("<path"));
assert.strictEqual(Q.continuousLabel(1), "1 day");
assert.strictEqual(Q.continuousLabel(42), "42 days");
assert.strictEqual(Q.weeklyLabel(0), "0 / 7 days");
assert.strictEqual(Q.weeklyLabel(1), "1 / 7 day");
assert.strictEqual(Q.weeklyLabel(7), "7 / 7 days");
assert.strictEqual(Q.weeklyLabel(8), "7 / 7 days");
assert.strictEqual(Q.weeklyLabel(90), "7 / 7 days");

const kept = memory();
const local = Q.seedFor(kept, "");
assert.strictEqual(Q.seedFor(kept, ""), local);
assert.ok(/^l[0-9a-z]+$/.test(local));
const linked = Q.seedFor(kept, seedA);
assert.strictEqual(linked, seedA);
assert.ok(!String(kept.getItem(Q.SEED_KEY)).includes("one-account-seed"));

const talk = { title: "Balance", src: "/talks/balance.mp3", setTitle: "Dharma Talks" };
const otherTalk = { title: "Meditation", src: "/talks/meditation.mp3" };
function can(src, opts) {
  return T.canPlay(src, opts);
}
const sections = [{ title: "Dharma Talks", talks: [otherTalk, talk] }];
assert.strictEqual(Q.segueOffer({ level: "sangha", quoteShown: true, sections, canPlay: can }), null);
assert.strictEqual(Q.segueOffer({ level: "zazen", quoteShown: false, sections, canPlay: can }), null);
assert.strictEqual(Q.segueOffer({ level: "zazen", quoteShown: true, sections: [], canPlay: can }), null);
const online = Q.segueOffer({
  level: "zazen", quoteShown: true, preferred: talk, sections, offline: false, canPlay: can,
});
assert.strictEqual(online.src, talk.src);
assert.strictEqual(online.title, "Balance");
const fallback = Q.segueOffer({
  level: "zazen", quoteShown: true, preferred: { title: "Missing", src: "/talks/../secret.mp3" }, sections, canPlay: can,
});
assert.strictEqual(fallback.src, otherTalk.src, "a quote whose talk cannot play yields another playable talk");
assert.strictEqual(Q.segueOffer({
  level: "zazen", quoteShown: true, preferred: talk, sections, offline: true, kept: new Set(), canPlay: can,
}), null, "offline with nothing kept stays quiet");
const cached = Q.segueOffer({
  level: "zazen",
  quoteShown: true,
  preferred: talk,
  sections,
  offline: true,
  kept: new Set([otherTalk.src]),
  canPlay: can,
});
assert.strictEqual(cached.src, otherTalk.src, "offline offers only a downloaded talk");
const keptPreferred = Q.segueOffer({
  level: "zazen",
  quoteShown: true,
  preferred: talk,
  sections,
  offline: true,
  kept: new Set([talk.src]),
  canPlay: can,
});
assert.strictEqual(keptPreferred.src, talk.src);
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "talks.json"), "utf8"));
const catalogKept = new Set(["/talks/meditation.mp3"]);
assert.strictEqual(T.talkSections(catalog, "zazen", { offline: true, kept: new Set() }).length, 0, "offline with nothing kept offers no catalog talk");
const onlyKept = T.talkSections(catalog, "zazen", { offline: true, kept: catalogKept });
const keptSrcs = onlyKept.flatMap((set) => set.talks.map((item) => item.src));
assert.ok(keptSrcs.length >= 1 && keptSrcs.every((src) => src === "/talks/meditation.mp3"), "offline offers only the downloaded catalog talk");
assert.strictEqual(T.canPlay("/talks/balance.mp3", { offline: true, kept: catalogKept }), false);
assert.strictEqual(T.canPlay("/talks/meditation.mp3", { offline: true, kept: catalogKept }), true);
const shelf = P.record(P.empty(), { date: "2026-11-08", theme: "", ms: 120000 }).store;
assert.strictEqual(Q.monthCells(2026, 11, shelf.days).cells.find((cell) => cell.day === 8).formal, false, "listening is not a calendar sit");

const nov = Q.monthCells(2026, 11, {
  "2026-11-01": { morning: 1, evening: 0 },
  "2026-11-02": { morning: 1, evening: 1 },
  "2026-11-03": { morning: 0, evening: 0, ms: 500000 },
  "2026-11-08": { morning: 0, evening: 1 },
});
assert.strictEqual(nov.label, "November 2026");
assert.strictEqual(nov.cells[0].empty, undefined);
assert.strictEqual(nov.cells[0].day, 1, "1 November 2026 is a Sunday");
assert.strictEqual(nov.cells[0].morning, true);
assert.strictEqual(nov.cells[0].evening, false);
assert.strictEqual(nov.cells[1].morning, true);
assert.strictEqual(nov.cells[1].evening, true);
assert.strictEqual(nov.cells[2].formal, false, "time without a formal sit is not a mark");
assert.strictEqual(nov.cells.find((cell) => cell.day === 8).evening, true);
assert.strictEqual(nov.cells.filter((cell) => !cell.empty).length, 30);

const lateEvening = P.record(P.empty(), {
  theme: "evening",
  ms: P.MIN_MS,
  at: new Date(2026, 10, 9, 1, 0).getTime(),
}).store;
const lateMonth = Q.monthCells(2026, 11, lateEvening.days);
assert.strictEqual(lateMonth.cells.find((cell) => cell.day === 8).date, "2026-11-08");
assert.strictEqual(lateMonth.cells.find((cell) => cell.day === 8).evening, true, "1:00 AM evening belongs to the day before");
assert.strictEqual(lateMonth.cells.find((cell) => cell.day === 9).formal, false);
assert.strictEqual(lateEvening.days["2026-11-08"].weekly, undefined, "weekly is not stored on the day");
assert.ok(!JSON.stringify(lateEvening).includes("weekly"));
const lateMorning = P.record(P.empty(), {
  theme: "morning",
  ms: P.MIN_MS,
  at: new Date(2026, 10, 9, 1, 0).getTime(),
}).store;
const dawnMonth = Q.monthCells(2026, 11, lateMorning.days);
assert.strictEqual(dawnMonth.cells.find((cell) => cell.day === 9).morning, true, "morning stays on the calendar day");
assert.strictEqual(dawnMonth.cells.find((cell) => cell.day === 8).formal, false);
const atTwo = P.record(P.empty(), {
  theme: "evening",
  ms: P.MIN_MS,
  at: new Date(2026, 10, 9, 2, 22).getTime(),
}).store;
assert.strictEqual(Q.monthCells(2026, 11, atTwo.days).cells.find((cell) => cell.day === 9).evening, true);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
const quietText = fs.readFileSync(path.join(__dirname, "quiet.js"), "utf8");
assert.ok(page.includes("[hidden] { display: none !important; }"));
assert.ok(page.includes('id="done-segue" hidden>Continue with a Dharma talk</button>'));
assert.ok(page.includes('id="home-streak"'));
assert.ok(page.includes('id="practice-cal" hidden role="dialog"'));
assert.ok(page.includes('id="talk-stop" hidden>Stop</button>'));
assert.ok(page.includes('id="talk-still" hidden>Back to stillness</button>'));
assert.ok(page.includes("prefers-reduced-motion"));
assert.ok(page.includes("@keyframes settle { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; }"));
assert.ok(page.includes("#done-words p { text-align: center; font-style: italic; color: #f3e6c8; }"));
assert.ok(page.includes("color: #f7edd4; font: inherit; font-size: 1rem;"));
assert.ok(page.includes("rgba(243, 230, 200, 0.72)"));
assert.strictEqual(page.includes("opacity: 0.05"), false);
assert.strictEqual(page.includes("opacity:.05"), false);
assert.ok(page.includes(".room:not([hidden]) .inner,\n    .index:not([hidden]),\n    .face:not([hidden]) { animation: none; }"));
assert.strictEqual(page.includes("Sample data"), false);
assert.strictEqual(page.includes("yantra-preview"), false);
assert.strictEqual(page.includes("Playback preview"), false);
assert.strictEqual(page.includes("Rama's inspiration appears here"), false);
assert.strictEqual(quietText.includes("fetch("), false);
assert.strictEqual(quietText.includes("XMLHttpRequest"), false);
assert.strictEqual(quietText.includes("sendBeacon"), false);
assert.strictEqual(quietText.includes("pentagram"), false);
assert.strictEqual(page.includes('id="motion-heart"'), false);
assert.strictEqual(page.includes("pentagram"), false);
const completion = page.slice(page.indexOf("function showCompletion()"), page.indexOf("window.showCompletion"));
assert.ok(!completion.includes("beginSegue("));
assert.ok(!completion.includes(".play("));
assert.ok(!completion.includes("commit("));
assert.ok(completion.includes("YantraQuotes.choose"));
const begin = page.slice(page.indexOf("function beginSegue"), page.indexOf("function returnToStillness"));
assert.ok(begin.includes("YantraTalks.play"));
assert.ok(!begin.includes("commit("));
assert.ok(!begin.includes("endSitting"));
assert.ok(!begin.includes("yantraMusicOffer"));
assert.ok(!begin.includes("spotify"));
assert.ok(shell.indexOf("talks.js") < shell.indexOf("quiet.js"));
assert.ok(sw.includes('"/web/quiet.js"'));
assert.ok(sw.includes("yantra-v10"));
const syncText = fs.readFileSync(path.join(__dirname, "sync.js"), "utf8");
const payload = syncText.slice(syncText.indexOf("function payloadOf"), syncText.indexOf("function labelBook"));
assert.ok(!payload.includes("markSeed"));
assert.ok(!payload.includes("quiet"));

const BrowserShots = require("./quiet.browser.test.js");
const defaultArtifacts = BrowserShots.artifactDir({});
assert.strictEqual(defaultArtifacts, path.join(os.tmpdir(), "yantra-quiet-artifacts"));
assert.ok(defaultArtifacts.startsWith(os.tmpdir()));
assert.notStrictEqual(defaultArtifacts, "/opt/cursor/artifacts");
assert.strictEqual(BrowserShots.artifactDir({ YANTRA_ARTIFACTS: "" }), defaultArtifacts);
assert.strictEqual(BrowserShots.artifactDir({ YANTRA_ARTIFACTS: "   " }), defaultArtifacts);
const configuredRoot = path.join(os.tmpdir(), "yantra-quiet-artifacts-configured");
assert.strictEqual(BrowserShots.artifactDir({ YANTRA_ARTIFACTS: configuredRoot }), path.resolve(configuredRoot));
assert.strictEqual(BrowserShots.artifactDir({ YANTRA_ARTIFACTS: "yantra-shots" }), path.resolve("yantra-shots"));
function probeWrite(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "quiet-write-probe.txt");
  fs.writeFileSync(file, "ok");
  assert.strictEqual(fs.readFileSync(file, "utf8"), "ok");
  fs.unlinkSync(file);
}
probeWrite(defaultArtifacts);
probeWrite(configuredRoot);
fs.rmdirSync(configuredRoot);

assert.ok(BrowserShots.CHROME_PATHS.indexOf("/usr/bin/chromium") === 0);
assert.ok(BrowserShots.CHROME_NAMES.indexOf("chromium") === 0);
assert.ok(BrowserShots.CHROME_PATHS.indexOf("/usr/bin/brave") > BrowserShots.CHROME_PATHS.indexOf("/usr/bin/chromium"));
const onlyChromium = (file) => file === "/usr/bin/chromium";
assert.strictEqual(BrowserShots.chromeExecutable({ PATH: "" }, { exists: onlyChromium, pathEnv: "" }), "/usr/bin/chromium");
const chromiumAndBrave = (file) => file === "/usr/bin/chromium" || file === "/usr/bin/brave";
assert.strictEqual(BrowserShots.chromeExecutable({}, { exists: chromiumAndBrave, pathEnv: "" }), "/usr/bin/chromium");
const bin = fs.mkdtempSync(path.join(os.tmpdir(), "yantra-browsers-"));
fs.writeFileSync(path.join(bin, "brave"), "");
fs.writeFileSync(path.join(bin, "chromium"), "");
fs.chmodSync(path.join(bin, "brave"), 0o755);
fs.chmodSync(path.join(bin, "chromium"), 0o755);
assert.strictEqual(BrowserShots.chromeExecutable({ PATH: bin }), path.join(bin, "chromium"));
assert.strictEqual(
  BrowserShots.chromeExecutable({ YANTRA_CHROME: "/usr/bin/chromium", PATH: bin }, { exists: onlyChromium, pathEnv: bin }),
  "/usr/bin/chromium"
);
assert.throws(() => BrowserShots.chromeExecutable({ YANTRA_CHROME: "/no/such/chromium" }, { exists: () => false, pathEnv: "" }), /YANTRA_CHROME/);
assert.strictEqual(BrowserShots.chromeExecutable({ YANTRA_CHROME: "  ", PATH: "" }, { exists: onlyChromium, pathEnv: "" }), "/usr/bin/chromium");
fs.rmSync(bin, { recursive: true });
const discovered = BrowserShots.chromeExecutable(process.env);
assert.strictEqual(fs.existsSync(discovered), true);
assert.strictEqual(fs.accessSync(discovered, fs.constants.X_OK), undefined);

(async () => {
  const key = Sync.generatePracticeKey();
  global.localStorage = memory();
  global.localStorage.setItem(Sync.STATE_KEY, JSON.stringify({
    practiceKey: key,
    deviceId: "ab".repeat(16),
    name: "",
    namedAt: 0,
    labels: {},
    peers: {},
    removed: {},
    pending: false,
  }));
  const mark = Sync.markSeed();
  assert.ok(mark.startsWith("m"));
  assert.strictEqual(Sync.markSeed(), mark);
  assert.ok(!mark.includes(key));
  const material = await Sync.derive(key);
  assert.notStrictEqual(mark, material.lookupId, "the drawing seed is not the id sent to the server");
  global.localStorage = memory();
  assert.strictEqual(Sync.markSeed(), "");
  console.log("quiet.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
