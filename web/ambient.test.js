/* node web/ambient.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sources = JSON.parse(fs.readFileSync(path.join(__dirname, "ambient/sources.json"), "utf8"));
const doc = fs.readFileSync(path.join(__dirname, "ambient/SOURCES.md"), "utf8");
const worker = fs.readFileSync(path.join(root, "deploy/cloudflare/worker.js"), "utf8");
const web = fs.readFileSync(path.join(__dirname, "web.js"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "sw.js"), "utf8");
const upload = fs.readFileSync(path.join(root, "deploy/cloudflare/upload-ambient.sh"), "utf8");
const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");

assert.strictEqual(sources.length, 4);
sources.forEach((row) => {
  assert.strictEqual(row.license, "Public domain");
  assert.ok(doc.includes(row.file), row.file);
  assert.ok(doc.includes(row.page), row.page);
  assert.ok(doc.includes(row.download), row.download);
  assert.ok(doc.includes(row.author), row.author);
  assert.ok(doc.includes("Public domain"));
  assert.ok(upload.includes("sources.json"));
  assert.strictEqual(/^rain-[a-z]+\.mp3$/.test(row.file), true);
});
assert.ok(doc.includes("PDSounds"));
assert.ok(worker.includes('const AMBIENT_PREFIX = "/ambient/"'));
assert.ok(worker.includes('env.AUDIO.get("ambient/" + name'));
assert.ok(web.includes('!url.startsWith("/ambient/")'));
assert.ok(sw.includes('url.pathname.startsWith("/ambient")'));
assert.ok(ignore.includes("web/ambient-stage/"));
assert.ok(upload.includes("ambient/"));
assert.ok(upload.includes("libmp3lame"));
assert.strictEqual(upload.includes("wrangler deploy"), false);

console.log("ambient.test.js ok");
