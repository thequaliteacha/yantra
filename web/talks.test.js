/* node web/talks.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const T = require("./talks.js");
const R = require("./resources.js");

const talk = T.entry({
  id: "example-talk",
  title: "  Example talk ",
  description: "A stand-in",
  kind: "talk",
  collection: "Dharma Talks",
  duration: 90,
  size: 0,
  source: "https://www.ramameditationsociety.org/meditation/",
  r2Key: "talks/example-talk.mp3",
  example: true,
});
assert.strictEqual(talk.url, "/talks/example-talk.mp3");
const shown = T.view(talk);
assert.strictEqual(shown.audio, "/talks/example-talk.mp3");
assert.strictEqual(shown.text, "");
assert.strictEqual(JSON.stringify(shown).includes("ramameditationsociety"), false);
assert.strictEqual(shown.credit, "from the Rama Meditation Society");

assert.strictEqual(T.entry(Object.assign({}, talk, { r2Key: "talks/other-talk.mp3", id: "example-talk" })), null);
assert.strictEqual(T.entry(Object.assign({}, talk, { r2Key: "https://www.ramameditationsociety.org/a.mp3" })), null);
assert.strictEqual(T.entry({ id: "example-quote", title: "Q", kind: "quote", collection: "Dharma Talks", duration: 0, size: 0, source: "example", r2Key: "" }), null);
assert.strictEqual(T.entry(Object.assign({}, talk, { collection: "" })), null);

const live = T.entry({
  id: "example-live",
  title: "Example live talk",
  description: "Stand-in",
  kind: "talk",
  collection: "Rama Live LA",
  duration: 120,
  size: 0,
  source: "https://www.ramameditationsociety.org/set/rama-live-LA",
  r2Key: "talks/rama-live-la/example-live.mp3",
  example: true,
});
assert.strictEqual(live.url, "/talks/rama-live-la/example-live.mp3");
assert.strictEqual(JSON.stringify(T.view(live)).includes("ramameditationsociety"), false);
assert.strictEqual(T.entry(Object.assign({}, live, { r2Key: "talks/rama-live-la/other.mp3" })), null);
assert.strictEqual(T.entry(Object.assign({}, live, { r2Key: "talks/../example-live.mp3" })), null);
assert.strictEqual(T.entry(Object.assign({}, live, { collection: "https://www.ramameditationsociety.org/set/rama-live-LA" })), null);

const quote = T.entry({
  id: "example-quote",
  title: "Example quote",
  description: "Text",
  kind: "quote",
  collection: "Dharma Talks",
  duration: 0,
  size: 0,
  source: "https://www.ramameditationsociety.org/meditation/",
  r2Key: "",
  text: "A line from the end of a sit.",
});
assert.strictEqual(T.view(quote).audio, "");
assert.strictEqual(T.view(quote).text, "A line from the end of a sit.");
assert.strictEqual(JSON.stringify(T.view(quote)).includes("http"), false);

const later = T.entry({
  id: "example-later",
  title: "Later",
  description: "A collection the list did not name in advance.",
  kind: "talk",
  collection: "Later notes",
  duration: 30,
  size: 0,
  source: "example",
  r2Key: "talks/example-later.mp3",
});
const items = T.catalog([
  later,
  live,
  talk,
  Object.assign({}, talk),
  { id: "nope", title: "Bad", kind: "song", collection: "Dharma Talks", duration: 1, size: 1, r2Key: "talks/nope.mp3" },
  quote,
]);
assert.deepStrictEqual(items.map((item) => item.id), ["example-later", "example-live", "example-talk", "example-quote"]);
assert.deepStrictEqual(T.collections(items).map((group) => group.collection), ["Dharma Talks", "Rama Live LA", "Later notes"]);
assert.deepStrictEqual(T.collections(items)[0].groups.map((group) => group.heading), ["Talks", "Quotes"]);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "talks.json"), "utf8"));
const onDisk = T.catalog(manifest);
assert.deepStrictEqual(T.COLLECTIONS, ["Dharma Talks", "Rama Live LA"]);
assert.strictEqual(onDisk.length, 16);
assert.deepStrictEqual(T.collections(onDisk).map((group) => group.collection), ["Dharma Talks", "Rama Live LA"]);
assert.strictEqual(onDisk.filter((item) => item.collection === "Dharma Talks" && item.kind === "talk").length, 4);
assert.strictEqual(onDisk.filter((item) => item.collection === "Rama Live LA" && item.kind === "talk").length, 6);
assert.strictEqual(onDisk.filter((item) => item.kind === "quote").length, 6);
assert.ok(onDisk.every((item) => item.example !== true));
assert.ok(onDisk.every((item) => !item.url.startsWith("http")));
assert.ok(onDisk.filter((item) => item.kind === "talk").every((item) => item.url === "/" + item.r2Key && item.duration > 0 && item.size > 0));
assert.ok(onDisk.some((item) => item.r2Key === "talks/rama-live-la/rama-live-la-02-cosmic-awareness.mp3"));
const intermediate = onDisk.find((item) => item.id === "intermediate-meditation");
assert.strictEqual(intermediate.duration, 3557);
assert.strictEqual(intermediate.size, 57366419);
assert.ok(intermediate.quotes[0].includes("you’re touching light more deeply"));
assert.strictEqual(intermediate.attribution, "Rama – Dr. Frederick Lenz");
assert.strictEqual(intermediate.source, "https://www.ramameditationsociety.org/free-resource/intermediate-meditation/");
assert.strictEqual(JSON.stringify(T.view(intermediate)).includes("http"), false);
assert.strictEqual(JSON.stringify(T.view(intermediate)).includes("fredericklenzfoundation"), false);
const practice = onDisk.find((item) => item.id === "meditation-practice-quote-01");
assert.strictEqual(practice.url, "");
assert.strictEqual(practice.attribution, "");
assert.strictEqual(T.view(practice).attribution, "");
assert.ok(practice.text.startsWith("Meditation is the process of silencing our thoughts."));
assert.strictEqual(JSON.stringify(T.view(practice)).includes("http"), false);
assert.ok(onDisk.filter((item) => item.kind === "quote").every((item) => item.text && !item.attribution && item.quotes.length === 0));
const named = T.entry({
  id: "named-quote",
  title: "Named",
  kind: "quote",
  collection: "Dharma Talks",
  durationSec: null,
  sizeBytes: null,
  sourcePageUrl: "https://www.ramameditationsociety.org/meditation/",
  r2Key: null,
  text: "A line.",
  attribution: "Rama – Dr. Frederick Lenz",
});
assert.strictEqual(named.duration, 0);
assert.strictEqual(named.size, 0);
assert.strictEqual(named.r2Key, "");
assert.strictEqual(T.view(named).attribution, "Rama – Dr. Frederick Lenz");
assert.strictEqual(JSON.stringify(T.view(named)).includes("http"), false);

assert.strictEqual(R.room, "talks");
assert.strictEqual(R.credit, "from the Rama Meditation Society");
assert.ok(R.note.includes("quotes from the end of the sits"));
const resourcesJs = fs.readFileSync(path.join(__dirname, "resources.js"), "utf8");
assert.strictEqual(resourcesJs.includes("http"), false);
assert.strictEqual(resourcesJs.includes("ramafoundation.org"), false);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const practiceAt = page.indexOf("<h3>Practice</h3>");
const resourcesAt = page.indexOf("<h3>Resources</h3>");
const privacyAt = page.indexOf("<h3>Privacy</h3>", resourcesAt);
assert.ok(practiceAt > 0 && resourcesAt > practiceAt && privacyAt > resourcesAt);
const block = page.slice(resourcesAt, privacyAt);
assert.ok(block.includes('id="account-resources"'));
assert.ok(block.includes("from the Rama Meditation Society"));
assert.ok(fs.readFileSync(path.join(__dirname, "talks.js"), "utf8").includes("Rama Live LA"));
assert.ok(fs.readFileSync(path.join(__dirname, "account.js"), "utf8").includes("paintTalkResources"));
assert.strictEqual(block.includes("http"), false);
assert.strictEqual(block.includes("target="), false);
assert.ok(page.includes('id="talks"'));
assert.ok(page.includes('id="talks-audio"'));
assert.ok(page.includes("playsinline"));
assert.ok(page.includes('id="talks-quote-text"'));
assert.ok(page.includes('id="talks-quote-by"'));
assert.ok(page.includes("yantraTalksPause"));
assert.strictEqual(page.includes("iframe"), false);

const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
assert.ok(sw.includes('url.pathname.startsWith("/talks/")'));
const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
assert.ok(web.includes('path.startsWith("/talks/")'));
const worker = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/worker.js"), "utf8");
assert.ok(worker.includes('pathname.startsWith("/talks/")'));
const upload = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/upload-talks.sh"), "utf8");
assert.ok(upload.includes("yantra-sangha-audio"));
assert.ok(upload.includes("prefix=talks/"));
assert.ok(upload.includes("grep -qxF"));
assert.ok(upload.includes("talks-stage"));
assert.ok(upload.includes('.talks'));
assert.strictEqual(upload.includes("wrangler deploy"), false);
const build = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/build.sh"), "utf8");
assert.ok(build.includes("talks-stage"));

console.log("talks.test.js ok");
