/* node web/resources.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const R = require("./resources.js");

assert.strictEqual(R.room, "talks");
assert.strictEqual(R.credit, "from the Rama Meditation Society");
assert.ok(R.note.includes("meditations"));
assert.strictEqual(JSON.stringify(R).includes("http"), false);
assert.strictEqual(JSON.stringify(R).includes("ramafoundation.org"), false);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
const practiceAt = page.indexOf("<h3>Practice</h3>");
const resourcesAt = page.indexOf("<h3>Resources</h3>");
assert.ok(practiceAt > 0 && resourcesAt > practiceAt);
assert.ok(page.includes('id="account-resources"'));
assert.strictEqual(account.includes('target = "_blank"'), false);
assert.strictEqual(account.includes("noopener"), false);
assert.strictEqual(account.includes("iframe"), false);
assert.strictEqual(page.includes("ramafoundation.org"), false);

console.log("resources.test.js ok");
