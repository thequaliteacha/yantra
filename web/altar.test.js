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
// Mindfulness material, then the altar section, then practice.
const at = (mark) => page.indexOf(mark);
assert.ok(at('id="account-mindful"') < at('id="account-altar-block"'));
assert.ok(at('id="account-altar-block"') < at('id="account-practice-block"'));
assert.ok(at('id="account-practice-block"') < at('id="account-profile"'));
assert.ok(at('id="account-altar"') < at('id="account-profile"'), "the altar is no longer inside profile");
assert.ok(page.includes('<h2 id="account-title">Mindfulness Material</h2>'), "the page opens on Mindfulness Material, not a name");
assert.ok(page.includes("<summary>Altar</summary>"));
assert.ok(page.includes("meditation, enlightenment, power, and peace"));
assert.ok(page.includes('id="home-altar" class="altar-photos"'));
assert.ok(page.includes('id="pick-altar" class="altar-photos"'));
assert.ok(page.includes('id="altar-list" class="altar-photos"'));
assert.ok(page.includes('id="altar" class="altar-photos"'));
assert.ok(page.includes(".altar-photos img"));
assert.ok(page.includes("gap: var(--altar-gap, 1.15rem)"));
assert.ok(page.includes("width: var(--altar-size, 4.4rem)"));
assert.ok(page.includes("box-sizing: border-box;"), "the ring is inside the circle");
assert.strictEqual(page.includes("3 * 4.4rem + 2 * 1.15rem + 2px"), false, "the row is no longer locked to three across");
assert.ok(page.includes("width: min(100%, 72rem)"), "home can grow wide enough for one row");
assert.ok(page.includes("justify-content: safe center"), "a tall home starts at the top instead of clipping it");
assert.ok(fs.readFileSync(path.join(__dirname, "altar.js"), "utf8").includes("home-altar"));
assert.ok(fs.readFileSync(path.join(__dirname, "altar.js"), "utf8").includes("pick-altar"));

function fits(plan, width) {
  const widest = plan.rows.reduce((m, n) => Math.max(m, n), 0);
  return widest * plan.size + Math.max(0, widest - 1) * plan.gap <= width + 0.6;
}
const wide = A.arrange(5, 1360, { oneRow: true, preferred: 70.4, gap: 18.4 });
assert.deepStrictEqual(wide.rows, [5], "five photos stay on one row on a wide screen");
assert.ok(wide.size <= 70.4 && wide.size > 60);
assert.ok(fits(wide, 1360));
const laptop = A.arrange(5, 1280, { oneRow: true, preferred: 70.4, gap: 18.4 });
assert.deepStrictEqual(laptop.rows, [5]);
assert.ok(fits(laptop, 1280));
const eight = A.arrange(8, 1400, { oneRow: true, preferred: 70.4, gap: 18.4 });
assert.deepStrictEqual(eight.rows, [8], "up to eight stay on one wide row");
assert.ok(fits(eight, 1400));
const phone = A.arrange(5, 312, { oneRow: false, preferred: 70.4, gap: 18.4 });
assert.deepStrictEqual(phone.rows, [3, 2], "a phone wraps five as three then two");
assert.ok(fits(phone, 312));
assert.notDeepStrictEqual(phone.rows, [2, 2, 1]);
const narrower = A.arrange(5, 342, { oneRow: false, preferred: 70.4, gap: 18.4 });
assert.deepStrictEqual(narrower.rows, [3, 2]);
assert.ok(fits(narrower, 342));
assert.deepStrictEqual(A.arrange(6, 320, { oneRow: false, preferred: 70.4, gap: 18.4 }).rows, [3, 3]);
assert.deepStrictEqual(A.arrange(4, 300, { oneRow: false, preferred: 70.4, gap: 18.4 }).rows, [2, 2]);
assert.deepStrictEqual(A.arrange(1, 280, { oneRow: false, preferred: 70.4, gap: 18.4 }).rows, [1]);
assert.deepStrictEqual(A.arrange(8, 340, { oneRow: false, preferred: 70.4, gap: 18.4 }).rows, [4, 4]);
assert.deepStrictEqual(A.arrange(8, 320, { oneRow: false, preferred: 70.4, gap: 18.4 }).rows, [3, 3, 2]);
assert.ok(fits(A.arrange(8, 320, { oneRow: false, preferred: 70.4, gap: 18.4 }), 320));
const ipad = A.arrange(5, 720, { oneRow: true, preferred: 70.4, gap: 18.4 });
assert.deepStrictEqual(ipad.rows, [5], "an iPad-width home keeps five on one row");
assert.ok(fits(ipad, 720));
console.log("altar.test.js ok");
