/* node web/resources.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const R = require("./resources.js");

assert.deepStrictEqual(R.groups.map((group) => group.heading), ["Talks", "Meditations", "Quotes", "Also published"]);
assert.ok(R.groups[1].items.length >= 4);
assert.ok(R.groups[2].items.length >= 4);
const seen = new Set();
for (const group of R.groups) {
  for (const item of group.items) {
    assert.ok(item.label.length > 0 && item.label.length < 60);
    assert.ok(item.note.length > 0 && item.note.length < 120);
    assert.ok(item.url.startsWith("https://www.ramameditationsociety.org/"));
    assert.strictEqual(item.url.includes("ramafoundation.org"), false);
    assert.strictEqual(item.url.includes("?"), false, item.url);
    assert.strictEqual(/utm_|fbclid|gclid/.test(item.url), false);
    const key = group.heading + " " + item.url;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
}
assert.strictEqual(R.list.length, seen.size);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
const practiceAt = page.indexOf("<h3>Practice</h3>");
const resourcesAt = page.indexOf("<h3>Resources</h3>");
assert.ok(practiceAt > 0 && resourcesAt > practiceAt);
assert.ok(page.includes('id="account-resources"'));
assert.ok(account.includes('rel = "noopener noreferrer"'));
assert.ok(account.includes('target = "_blank"'));
assert.ok(account.includes("group.heading"));
assert.strictEqual(account.includes("iframe"), false);
assert.strictEqual(page.includes("ramafoundation.org"), false);

console.log("resources.test.js ok");
