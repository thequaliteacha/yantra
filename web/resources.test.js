/* node web/resources.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const R = require("./resources.js");

assert.deepStrictEqual(R.groups.map((group) => group.heading), ["Dharma talks"]);
assert.strictEqual(R.groups[0].items[0].url, "https://www.ramameditationsociety.org/meditation/");
assert.ok(R.groups[0].items[0].note.includes("quotes from the end of the sits"));
const seen = new Set();
for (const group of R.groups) {
  for (const item of group.items) {
    assert.ok(item.label.length > 0 && item.label.length < 60);
    assert.ok(item.note.length > 0 && item.note.length < 140);
    assert.ok(item.url.startsWith("https://www.ramameditationsociety.org/meditation"));
    assert.strictEqual(item.url.includes("ramafoundation.org"), false);
    assert.strictEqual(item.url.includes("/free-resource/"), false, item.url);
    assert.strictEqual(item.url.includes("?"), false, item.url);
    assert.strictEqual(/utm_|fbclid|gclid/.test(item.url), false);
    const key = group.heading + " " + item.url;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
}
assert.strictEqual(R.list.length, seen.size);
assert.strictEqual(R.list.length, 5);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
// The links are kept for later but not shown on the page for now.
assert.strictEqual(page.includes('id="account-resources"'), false);
assert.ok(account.includes('rel = "noopener noreferrer"'));
assert.ok(account.includes('target = "_blank"'));
assert.ok(account.includes("group.heading"));
assert.strictEqual(account.includes("iframe"), false);
assert.strictEqual(page.includes("ramafoundation.org"), false);

console.log("resources.test.js ok");
