/* node web/altar.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const A = require("./altar.js");
const S = require("./settings.js");

// The centre square of any photo fills the altar circle.
assert.deepStrictEqual(A.cover(640, 480, 320), { w: 427, h: 320, x: -53, y: 0 });
assert.deepStrictEqual(A.cover(480, 960, 320), { w: 320, h: 640, x: 0, y: -160 });

// Only small JPEG data, at most three, is kept; nothing else gets in.
const store = {};
const mem = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
S.set("altar.photos", [jpeg, "javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/a.jpg", jpeg, jpeg, jpeg], mem);
assert.deepStrictEqual(S.get("altar.photos", mem), [jpeg, jpeg, jpeg]);
S.set("altar.photos", ["data:image/jpeg;base64," + "A".repeat(300000)], mem);
assert.deepStrictEqual(S.get("altar.photos", mem), [], "an oversized photo is refused");
assert.strictEqual(S.get("altar.show", mem), true);
S.set("altar.show", false, mem);
assert.strictEqual(S.get("altar.show", mem), false);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.ok(loader.includes('src="altar.js"'));
assert.ok(page.includes('id="altar" aria-hidden="true"'));
assert.ok(page.includes('id="altar-file" type="file" accept="image/*" hidden'));
// The places come first on the You page, then practice, then the altar.
const at = (mark) => page.indexOf(mark);
assert.ok(at('id="account-mindful"') < at('id="account-places"'));
assert.ok(at('id="account-places"') < at('id="account-practice-block"'));
assert.ok(at('id="account-practice-block"') < at('id="account-altar"'));
assert.ok(page.includes('<h2 id="account-title">You</h2>'));
console.log("altar.test.js ok");
