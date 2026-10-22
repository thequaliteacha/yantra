/* node web/awakening.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const A = require("./awakening.js");
const S = require("./settings.js");

function mem(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

function signed(before, after) {
  let d = after - before;
  d = ((d + Math.PI) % A.TAU + A.TAU) % A.TAU - Math.PI;
  return d;
}

const full = A.outerRate(1, false);
assert.ok(full > 0, "the outer wheel stays clockwise");
assert.strictEqual(full, A.TAU / A.OUTER_PERIOD);
assert.strictEqual(A.outerRate(1, true), full * A.REDUCE_FACTOR);
assert.ok(A.outerRate(1, true) > 0, "reduced motion slows the outer wheel and does not reverse it");
assert.strictEqual(A.outerRate(0, false), 0);
assert.strictEqual(A.outerRate(2, false), full);

const inner = A.innerRate(1, false, true);
assert.ok(inner < 0, "the inner wheel turns counterclockwise");
assert.strictEqual(inner, -A.INNER_RATIO * full);
assert.strictEqual(A.INNER_RATIO, 0.5);
assert.ok(Math.abs(inner) < full, "the inner wheel is the slower of the two");
assert.strictEqual(A.innerRate(1, true, true), -A.INNER_RATIO * A.outerRate(1, true));
assert.ok(A.innerRate(1, true, true) < 0, "reduced motion keeps the inner wheel counterclockwise");
assert.ok(Math.abs(A.innerRate(1, true, true)) < Math.abs(inner));
assert.strictEqual(A.innerRate(1, false, false), 0, "the toggle stops the inner wheel");
assert.strictEqual(A.innerRate(1, true, false), 0);

const stepped = A.step({ outer: 0, inner: 0 }, 2, {
  drive: 1, reduce: false, enabled: true, now: 1000, energy: 0.4, lotus: "naval",
});
assert.ok(signed(0, stepped.outer) > 0, "a step of the outer wheel is clockwise");
assert.ok(signed(0, stepped.inner) < 0, "a step of the inner wheel is counterclockwise");
assert.ok(Math.abs(Math.abs(signed(0, stepped.inner)) / signed(0, stepped.outer) - A.INNER_RATIO) < 1e-9);
assert.strictEqual(stepped.wheels.outerSign, 1);
assert.strictEqual(stepped.wheels.innerSign, -1);
assert.strictEqual(stepped.wheels.innerTarget, "petals");

const slow = A.step({ outer: 0, inner: 0 }, 2, {
  drive: 1, reduce: true, enabled: true, now: 1000, energy: 1, lotus: "eye",
});
assert.ok(slow.outerRate > 0 && slow.outerRate < stepped.outerRate);
assert.ok(slow.innerRate < 0 && Math.abs(slow.innerRate) < Math.abs(stepped.innerRate));
assert.strictEqual(slow.breath.scale, 1, "reduced motion turns the vibration off");
assert.strictEqual(slow.breath.glow, 0);
assert.strictEqual(slow.breath.tremor, 0);
assert.strictEqual(slow.wheels.innerTarget, "figure");
assert.strictEqual(slow.wheels.outerSign, 1);

const off = A.step({ outer: 0.4, inner: 0.4 }, 1, {
  drive: 1, reduce: false, enabled: false, lotus: "naval",
});
assert.ok(off.outerRate > 0, "switching awakening off leaves the outer clockwise pace");
assert.strictEqual(off.innerRate, 0);
assert.strictEqual(off.breath.scale, 1);
assert.strictEqual(off.wheels.innerSign, 0);

assert.deepStrictEqual(A.ORDER, ["root", "sacral", "naval", "heart", "throat", "eye", "crown"]);
A.ORDER.forEach((id) => {
  const on = A.wheels(id, true);
  const held = A.wheels(id, false);
  assert.strictEqual(on.outerSign, 1, id);
  assert.strictEqual(on.innerSign, -1, id);
  assert.strictEqual(held.outerSign, 1, id);
  assert.strictEqual(held.innerSign, 0, id);
  assert.strictEqual(on.innerTarget, id === "eye" || id === "heart" ? "figure" : "petals", id);
});
assert.strictEqual(A.wheels({ id: "eye", petals: 2 }, true).innerTarget, "figure");
assert.strictEqual(A.wheels({ petals: 12 }, true).innerTarget, "petals");
assert.strictEqual(A.wheels({ petals: 4, rings: 2 }, true).innerTarget, "petals");
assert.strictEqual(A.wheels({ id: "heart", petals: 12 }, true).innerTarget, "figure", "Anahata's star is its inner wheel");
assert.strictEqual(
  A.innerPetalAngle(0, 8, { petals: 12, innerTarget: "figure", turn: 0, spin: 2, inner: 1, tremor: 0.01 }),
  -Math.PI / 2,
  "Anahata's inner eight rest while the star turns"
);

const outerStill = A.outerPetalAngle(0, 12, 0, 0, 0);
const outerMoved = A.outerPetalAngle(0, 12, 0, stepped.outer, 0);
assert.ok(signed(outerStill, outerMoved) > 0, "outer petals take the clockwise spin");
assert.strictEqual(A.outerPetalAngle(3, 10, 0.2, 0.4, 1), -Math.PI / 2 + 0.2 + 0.4 + (3 * A.TAU) / 10 + 0.004);

const innerStill = A.innerPetalAngle(1, 8, { petals: 12, innerTarget: "petals", turn: 0, inner: 0, tremor: 0 });
const innerMoved = A.innerPetalAngle(1, 8, { petals: 12, innerTarget: "petals", turn: 0, inner: stepped.inner, tremor: 0 });
assert.ok(signed(innerStill, innerMoved) < 0, "inner petals take the counterclockwise spin");

const eyeStill = A.innerPetalAngle(0, 8, { petals: 2, innerTarget: "figure", turn: 0, spin: 0 });
const eyeMoved = A.innerPetalAngle(0, 8, { petals: 2, innerTarget: "figure", turn: 0, spin: slow.outer });
assert.ok(signed(eyeStill, eyeMoved) > 0, "Ajna's only petal ring keeps the clockwise outer pace");
assert.ok(signed(0, slow.inner) < 0, "Ajna's inner triangle turns counterclockwise");

assert.strictEqual(A.innerPetalAngle(0, 8, { petals: 2, turn: 1.2 }), -Math.PI / 2, "undrawn wings do not drift the eight");
assert.ok(A.innerPetalAngle(0, 8, { petals: 10, turn: 1 }) < A.innerPetalAngle(0, 8, { petals: 10, turn: 0 }));

const quiet = A.breath(0, 0, false, false);
assert.strictEqual(quiet.scale, 1);
assert.strictEqual(quiet.glow, 0);
assert.strictEqual(quiet.tremor, 0);
assert.deepStrictEqual(A.breath(500, 1, true, true), quiet);

let prev = A.breath(0, 1, true, false).scale;
let quietMin = Infinity;
let quietMax = -Infinity;
let loudMin = Infinity;
let loudMax = -Infinity;
for (let t = 0; t <= 60000; t += 16) {
  const still = A.breath(t, 0, true, false);
  const loud = A.breath(t, 1, true, false);
  assert.ok(Math.abs(still.scale - 1) <= A.BREATH_LO + 1e-12, "quiet breath stays at the floor");
  assert.ok(Math.abs(loud.scale - 1) <= A.BREATH_HI + 1e-12, "the breath stays inside two percent");
  assert.ok(Math.abs(loud.glow) <= 0.06);
  assert.ok(Math.abs(loud.tremor) <= 0.02);
  assert.ok(Math.abs(loud.scale - prev) < 0.002, "one frame does not jump");
  prev = loud.scale;
  quietMin = Math.min(quietMin, still.scale);
  quietMax = Math.max(quietMax, still.scale);
  loudMin = Math.min(loudMin, loud.scale);
  loudMax = Math.max(loudMax, loud.scale);
}
assert.ok(quietMax - quietMin > 0.008, "the breath moves when the music is quiet");
assert.ok(loudMax - loudMin > quietMax - quietMin, "the music widens the breath");
assert.strictEqual(A.innerScale({ scale: 4 }), 1 + A.BREATH_HI);
assert.strictEqual(A.innerScale({ scale: 0 }), 1 - A.BREATH_HI);
assert.strictEqual(A.innerScale(null), 1);
assert.strictEqual(A.innerGlow(quiet), 0);

assert.strictEqual(A.advance(0, full, 10), A.advance(0, full, 0.5), "a long gap does not fling the wheel");
assert.ok(A.advance(0, -0.2, 1) > Math.PI);

assert.strictEqual(A.enabledFrom(true), true);
assert.strictEqual(A.enabledFrom(undefined), true);
assert.strictEqual(A.enabledFrom(false), false);
assert.strictEqual(A.enabledFrom("off"), false);

const store = mem();
assert.strictEqual(S.get("motion.awakening", store), true, "awakening motion defaults to on");
assert.strictEqual(S.set("motion.awakening", false, store), false);
assert.strictEqual(S.get("motion.awakening", store), false);
assert.strictEqual(S.set("motion.awakening", true, store), true);

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
assert.ok(page.includes('src="/web/awakening.js"'));
assert.ok(!page.includes('id="awakening"'), "there is no awakening switch");
assert.ok(!page.includes("Awakening motion"));
assert.ok(page.includes("window.awakeningOn = true;"));
assert.ok(page.includes("YantraAwakening.step"));
assert.ok(page.includes("awake.outerPetalAngle"));
assert.ok(page.includes("awake.innerPetalAngle"));
assert.ok(page.includes("reduce: reduceMotion"));
assert.ok(page.includes("prefers-reduced-motion"));
assert.ok(fs.readFileSync(path.join(__dirname, "../yantra.py"), "utf8").includes('"/web/awakening.js"'));

console.log("awakening.test.js ok");
