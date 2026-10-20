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
assert.strictEqual(T.entry({ id: "example-quote", title: "Q", kind: "quote", duration: 0, size: 0, source: "example", r2Key: "" }), null);

const quote = T.entry({
  id: "example-quote",
  title: "Example quote",
  description: "Text",
  kind: "quote",
  duration: 0,
  size: 0,
  source: "https://www.ramameditationsociety.org/meditation/",
  r2Key: "",
  text: "A line from the end of a sit.",
});
assert.strictEqual(T.view(quote).audio, "");
assert.strictEqual(T.view(quote).text, "A line from the end of a sit.");
assert.strictEqual(JSON.stringify(T.view(quote)).includes("http"), false);

const items = T.catalog([
  talk,
  Object.assign({}, talk),
  { id: "nope", title: "Bad", kind: "song", duration: 1, size: 1, r2Key: "talks/nope.mp3" },
  quote,
]);
assert.deepStrictEqual(items.map((item) => item.id), ["example-talk", "example-quote"]);
assert.deepStrictEqual(T.groups(items).map((group) => group.heading), ["Talks", "Quotes"]);

const onDisk = T.catalog(JSON.parse(fs.readFileSync(path.join(__dirname, "talks.json"), "utf8")));
assert.ok(onDisk.length >= 2 && onDisk.length <= 3);
assert.ok(onDisk.every((item) => item.example === true));
assert.ok(onDisk.some((item) => item.kind === "talk" && item.url.startsWith("/talks/")));
assert.ok(onDisk.some((item) => item.kind === "meditation" && item.url.startsWith("/talks/")));
assert.ok(onDisk.some((item) => item.kind === "quote" && item.text && item.url === ""));
assert.ok(onDisk.every((item) => !item.url.startsWith("http")));

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
assert.ok(block.includes('data-room="talks"'));
assert.ok(block.includes("from the Rama Meditation Society"));
assert.ok(block.includes("Dharma Talks"));
assert.strictEqual(block.includes("http"), false);
assert.strictEqual(block.includes("target="), false);
assert.ok(page.includes('id="talks"'));
assert.ok(page.includes('id="talks-audio"'));
assert.ok(page.includes("playsinline"));
assert.ok(page.includes('id="talks-quote-text"'));
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
assert.strictEqual(upload.includes("wrangler deploy"), false);
const build = fs.readFileSync(path.join(__dirname, "../deploy/cloudflare/build.sh"), "utf8");
assert.ok(build.includes("talks-stage"));

console.log("talks.test.js ok");
