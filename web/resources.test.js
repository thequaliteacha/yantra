/* node web/resources.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const R = require("./resources.js");

assert.ok(R.list.length >= 8);
const seen = new Set();
for (const item of R.list) {
  assert.strictEqual(typeof item.label, "string");
  assert.ok(item.label.length > 0 && item.label.length < 60);
  assert.ok(item.note.length > 0 && item.note.length < 120);
  assert.ok(item.url.startsWith("https://"));
  assert.strictEqual(item.url.includes("?"), false, item.url);
  assert.strictEqual(/utm_|fbclid|gclid/.test(item.url), false);
  assert.ok(!seen.has(item.url));
  seen.add(item.url);
}

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
assert.ok(page.includes('id="account-resources"'));
assert.ok(account.includes('rel = "noopener noreferrer"'));
assert.ok(account.includes('target = "_blank"'));
assert.strictEqual(account.includes("iframe"), false);

console.log("resources.test.js ok");
