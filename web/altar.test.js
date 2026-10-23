/* node web/altar.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const A = require("./altar.js");
const S = require("./settings.js");

// The centre square of any photo fills the altar circle.
assert.deepStrictEqual(A.cover(640, 480, 320), { w: 427, h: 320, x: -53, y: 0 });
assert.deepStrictEqual(A.cover(480, 960, 320), { w: 320, h: 640, x: 0, y: -160 });

// Only small JPEG data, at most six, is kept; nothing else gets in.
const store = {};
const mem = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
S.set("altar.photos", [jpeg, "javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/a.jpg", jpeg, jpeg, jpeg, jpeg, jpeg, jpeg], mem);
assert.deepStrictEqual(S.get("altar.photos", mem), Array(6).fill(jpeg));
assert.strictEqual(A.MAX, 6);
S.set("altar.photos", ["data:image/jpeg;base64," + "A".repeat(300000)], mem);
assert.deepStrictEqual(S.get("altar.photos", mem), [], "an oversized photo is refused");
assert.strictEqual(S.get("altar.show", mem), true);
S.set("altar.show", false, mem);
assert.strictEqual(S.get("altar.show", mem), false);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const loader = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert.ok(loader.includes('src="altar.js"'));
assert.ok(page.includes('id="altar" class="altar-photos" aria-hidden="true"'));
assert.ok(page.includes('id="altar-file" type="file" accept="image/*" hidden'));
// Mindfulness material, then practice, then the altar inside profile.
const at = (mark) => page.indexOf(mark);
assert.ok(at('id="account-mindful"') < at('id="account-practice-block"'));
assert.ok(at('id="account-practice-block"') < at('id="account-profile"'));
assert.ok(at('id="account-profile"') < at('id="account-altar"'));
assert.ok(page.includes('<h2 id="account-title">Mindfulness Material</h2>'), "the page opens on Mindfulness Material, not a name");
assert.ok(page.includes("meditation, enlightenment, power, and peace"));
assert.ok(page.includes('id="home-altar" class="altar-photos"'));
assert.ok(page.includes('id="pick-altar" class="altar-photos"'));
assert.ok(page.includes('id="altar-list" class="altar-photos"'));
assert.ok(page.includes('id="altar" class="altar-photos"'));
assert.ok(page.includes(".altar-photos img"));
assert.ok(page.includes("gap: 1.15rem"));
assert.ok(page.includes("width: 4.4rem"));
assert.ok(page.includes("box-sizing: border-box;\n    width: 4.4rem"), "the ring is inside the circle");
assert.ok(page.includes("3 * 4.4rem + 2 * 1.15rem + 2px"), "three photos fit one row on a phone");
assert.ok(fs.readFileSync(path.join(__dirname, "altar.js"), "utf8").includes("home-altar"));
assert.ok(fs.readFileSync(path.join(__dirname, "altar.js"), "utf8").includes("pick-altar"));
console.log("altar.test.js ok");
